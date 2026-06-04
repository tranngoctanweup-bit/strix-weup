"""
Strix Pro - Report Generation Service
HTML templates + WeasyPrint PDF generation
"""

import os
import json
import logging
from datetime import datetime
from typing import Optional, Dict, List
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session
from src.db.models import Target, Scan, Vulnerability, Report, SeverityLevel

logger = logging.getLogger(__name__)

REPORTS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'reports')
os.makedirs(REPORTS_DIR, exist_ok=True)

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), '..', 'templates')

class ReportService:
    def __init__(self):
        self.env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))

    def generate_report(self, db: Session, target_id: Optional[int] = None, report_type: str = "full") -> Dict:
        """Generate a security report"""
        # Get data
        if target_id:
            target = db.query(Target).filter(Target.id == target_id).first()
            if not target:
                raise ValueError("Target not found")
            scans = db.query(Scan).filter(Scan.target_id == target_id).all()
            vulns = db.query(Vulnerability).filter(Vulnerability.target_id == target_id).all()
        else:
            target = None
            scans = db.query(Scan).all()
            vulns = db.query(Vulnerability).all()

        # Build report data
        report_data = {
            "generated_at": datetime.utcnow().isoformat(),
            "report_type": report_type,
            "target": {
                "name": target.name if target else "All Targets",
                "host": target.host if target else "N/A",
                "type": target.type if target else "N/A"
            } if target else None,
            "summary": {
                "total_scans": len(scans),
                "completed_scans": len([s for s in scans if s.status == "completed"]),
                "failed_scans": len([s for s in scans if s.status == "failed"]),
                "total_vulnerabilities": len(vulns),
                "critical": len([v for v in vulns if v.severity == "critical"]),
                "high": len([v for v in vulns if v.severity == "high"]),
                "medium": len([v for v in vulns if v.severity == "medium"]),
                "low": len([v for v in vulns if v.severity == "low"]),
                "info": len([v for v in vulns if v.severity == "info"]),
                "fixed": len([v for v in vulns if v.is_fixed]),
                "unfixed": len([v for v in vulns if not v.is_fixed]),
            },
            "scans": [
                {
                    "id": s.id,
                    "type": s.scan_type,
                    "tool": s.tool,
                    "status": s.status,
                    "duration": s.duration,
                    "ai_summary": s.ai_summary,
                    "created_at": s.created_at.isoformat() if s.created_at else None
                }
                for s in scans
            ],
            "vulnerabilities": [
                {
                    "id": v.id,
                    "title": v.title,
                    "severity": v.severity,
                    "cvss_score": v.cvss_score,
                    "cve_id": v.cve_id,
                    "cwe_id": v.cwe_id,
                    "affected_component": v.affected_component,
                    "description": v.description,
                    "evidence": v.evidence,
                    "remediation": v.remediation,
                    "is_fixed": v.is_fixed
                }
                for v in vulns
            ]
        }

        # Generate HTML
        template = self.env.get_template("report_template.html")
        html_content = template.render(report=report_data)

        # Generate PDF
        pdf_path = None
        try:
            from weasyprint import HTML
            filename = f"report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
            pdf_path = os.path.join(REPORTS_DIR, filename)
            HTML(string=html_content).write_pdf(pdf_path)
        except ImportError:
            logger.warning("WeasyPrint not installed, skipping PDF generation")
        except Exception as e:
            logger.error(f"PDF generation failed: {e}")

        # Save to DB
        report = Report(
            title=f"Security Report - {target.name if target else 'All Targets'}",
            target_id=target_id,
            report_type=report_type,
            content=json.dumps(report_data, indent=2),
            file_path=pdf_path,
            format="pdf" if pdf_path else "json"
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        return {
            "report_id": report.id,
            "data": report_data,
            "pdf_path": pdf_path,
            "html": html_content
        }

    def list_reports(self, db: Session) -> List[Dict]:
        reports = db.query(Report).order_by(Report.created_at.desc()).all()
        return [
            {
                "id": r.id,
                "title": r.title,
                "report_type": r.report_type,
                "format": r.format,
                "file_path": r.file_path,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in reports
        ]

    def get_report(self, db: Session, report_id: int) -> Optional[Dict]:
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            return None
        return {
            "id": report.id,
            "title": report.title,
            "report_type": report.report_type,
            "format": report.format,
            "content": json.loads(report.content) if report.content else None,
            "file_path": report.file_path,
            "created_at": report.created_at.isoformat() if report.created_at else None
        }

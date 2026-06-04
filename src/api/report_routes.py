"""
Strix Pro - Report API Routes
"""

import os
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from src.db.models import get_db
from src.services.report_service import ReportService

router = APIRouter(prefix="/api/reports", tags=["reports"])
report_service = ReportService()

class GenerateReportRequest(BaseModel):
    target_id: Optional[int] = None
    report_type: str = "full"

@router.post("/generate")
async def generate_report(request: GenerateReportRequest, db: Session = Depends(get_db)):
    try:
        result = report_service.generate_report(db, request.target_id, request.report_type)
        return {
            "report_id": result["report_id"],
            "data": result["data"],
            "pdf_path": result["pdf_path"]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/")
async def list_reports(db: Session = Depends(get_db)):
    return report_service.list_reports(db)

@router.get("/{report_id}")
async def get_report(report_id: int, db: Session = Depends(get_db)):
    result = report_service.get_report(db, report_id)
    if not result:
        raise HTTPException(status_code=404, detail="Report not found")
    return result

@router.get("/{report_id}/download")
async def download_report(report_id: int, db: Session = Depends(get_db)):
    result = report_service.get_report(db, report_id)
    if not result:
        raise HTTPException(status_code=404, detail="Report not found")
    if not result["file_path"] or not os.path.exists(result["file_path"]):
        raise HTTPException(status_code=404, detail="PDF file not found")
    return FileResponse(
        result["file_path"],
        media_type="application/pdf",
        filename=os.path.basename(result["file_path"])
    )

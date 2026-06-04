"""
Strix Pro - Database Models
SQLAlchemy models for storing scan results and history
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from enum import Enum
import os

# Database setup
DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'strix.db')
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

engine = create_engine(f'sqlite:///{DB_PATH}', echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Enums
class ScanStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class SeverityLevel(Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ScanType(Enum):
    PORT_SCAN = "port_scan"
    SUBDOMAIN = "subdomain"
    WEB_SCAN = "web_scan"
    VULNERABILITY = "vulnerability"
    FULL_PENTEST = "full_pentest"
    CUSTOM = "custom"

# Models
class Target(Base):
    """Target host/domain to scan"""
    __tablename__ = "targets"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    host = Column(String(255), nullable=False)  # IP or domain
    type = Column(String(50), default="domain")  # domain, ip, url
    description = Column(Text)
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    scans = relationship("Scan", back_populates="target")
    vulnerabilities = relationship("Vulnerability", back_populates="target")

class Scan(Base):
    """Scan execution record"""
    __tablename__ = "scans"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    target_id = Column(Integer, ForeignKey("targets.id"))
    scan_type = Column(String(50), nullable=False)
    tool = Column(String(100))
    command = Column(Text)
    status = Column(String(20), default=ScanStatus.PENDING.value)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration = Column(Integer)  # seconds
    output = Column(Text)
    error = Column(Text)
    ai_summary = Column(Text)  # AI-generated summary
    extra_metadata = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    target = relationship("Target", back_populates="scans")
    vulnerabilities = relationship("Vulnerability", back_populates="scan")

class Vulnerability(Base):
    """Detected vulnerability"""
    __tablename__ = "vulnerabilities"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    target_id = Column(Integer, ForeignKey("targets.id"))
    scan_id = Column(Integer, ForeignKey("scans.id"))
    title = Column(String(500), nullable=False)
    description = Column(Text)
    severity = Column(String(20), default=SeverityLevel.INFO.value)
    cvss_score = Column(Integer)  # 0-100
    cve_id = Column(String(50))
    cwe_id = Column(String(50))
    affected_component = Column(String(500))
    evidence = Column(Text)
    remediation = Column(Text)
    references = Column(JSON, default=list)
    is_confirmed = Column(Boolean, default=False)
    is_fixed = Column(Boolean, default=False)
    fixed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    target = relationship("Target", back_populates="vulnerabilities")
    scan = relationship("Scan", back_populates="vulnerabilities")

class ScanSchedule(Base):
    """Scheduled scan configuration"""
    __tablename__ = "scan_schedules"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    target_id = Column(Integer, ForeignKey("targets.id"))
    name = Column(String(255), nullable=False)
    scan_type = Column(String(50), nullable=False)
    tool = Column(String(100))
    cron_expression = Column(String(100))  # e.g., "0 2 * * *" for daily at 2am
    is_active = Column(Boolean, default=True)
    last_run = Column(DateTime)
    next_run = Column(DateTime)
    config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

class ChatHistory(Base):
    """AI chat history"""
    __tablename__ = "chat_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)  # user, assistant, system, tool
    content = Column(Text, nullable=False)
    tool_calls = Column(JSON)
    tool_call_id = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

class Report(Base):
    """Generated report"""
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(500), nullable=False)
    target_id = Column(Integer, ForeignKey("targets.id"))
    report_type = Column(String(50))  # full, executive, technical
    content = Column(Text)
    file_path = Column(String(500))
    format = Column(String(20), default="json")  # json, pdf, html
    created_at = Column(DateTime, default=datetime.utcnow)

# Create tables
def init_db():
    """Initialize database"""
    Base.metadata.create_all(bind=engine)
    seed_admin_user()


def seed_admin_user():
    """Create default admin user if no users exist"""
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            admin = User(
                name="Admin",
                email="admin@strix.pro",
                hashed_password=pwd_ctx.hash("admin123"),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print("✅ Default admin user created (admin@strix.pro / admin123)")
    finally:
        db.close()

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper functions
def create_target(db, name: str, host: str, target_type: str = "domain", description: str = "", tags: list = None):
    """Create a new target"""
    target = Target(
        name=name,
        host=host,
        type=target_type,
        description=description,
        tags=tags or []
    )
    db.add(target)
    db.commit()
    db.refresh(target)
    return target

def create_scan(db, target_id: int, scan_type: str, tool: str = None, command: str = None):
    """Create a new scan"""
    scan = Scan(
        target_id=target_id,
        scan_type=scan_type,
        tool=tool,
        command=command,
        status=ScanStatus.PENDING.value,
        started_at=datetime.utcnow()
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return scan

def update_scan_status(db, scan_id: int, status: str, output: str = None, error: str = None, ai_summary: str = None):
    """Update scan status"""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if scan:
        scan.status = status
        if output:
            scan.output = output
        if error:
            scan.error = error
        if ai_summary:
            scan.ai_summary = ai_summary
        if status == ScanStatus.COMPLETED.value:
            scan.completed_at = datetime.utcnow()
            if scan.started_at:
                scan.duration = int((scan.completed_at - scan.started_at).total_seconds())
        db.commit()
    return scan

def create_vulnerability(db, target_id: int, scan_id: int, title: str, severity: str, **kwargs):
    """Create a new vulnerability"""
    vuln = Vulnerability(
        target_id=target_id,
        scan_id=scan_id,
        title=title,
        severity=severity,
        **kwargs
    )
    db.add(vuln)
    db.commit()
    db.refresh(vuln)
    return vuln


class User(Base):
    """User account"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="user")  # admin, user, viewer
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Repository(Base):
    """Git repository for secret scanning"""
    __tablename__ = "repositories"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    url = Column(String(500), nullable=False)
    provider = Column(String(50), default="github")  # github, gitlab, bitbucket
    description = Column(Text)
    status = Column(String(20), default="active")
    secrets_found = Column(Integer, default=0)
    last_scanned_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class NetworkRange(Base):
    """Network range for host discovery"""
    __tablename__ = "network_ranges"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    cidr = Column(String(50), nullable=False)  # e.g., "192.168.1.0/24"
    description = Column(Text)
    status = Column(String(20), default="active")
    hosts_discovered = Column(Integer, default=0)
    last_scanned_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class Integration(Base):
    """Third-party integration"""
    __tablename__ = "integrations"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # slack, jira, webhook, pagerduty, email
    config = Column(JSON, default=dict)
    enabled = Column(Boolean, default=True)
    status = Column(String(20), default="active")
    last_triggered_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

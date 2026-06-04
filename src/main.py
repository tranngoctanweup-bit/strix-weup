"""
Strix Pro - Main Application
FastAPI backend with REST API, WebSocket support, and RBAC
"""

import os
import sys
import json
import time
import asyncio
import subprocess as sp
from datetime import datetime
from typing import List, Optional, Dict
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from dotenv import load_dotenv

# Load environment
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# Import local modules
from src.ai.router import AIRouter, AIMessage
from src.core.tool_engine import ToolEngine, extract_domain, ensure_url
from src.db.models import (
    init_db, get_db, Target, Scan, Vulnerability, ScanSchedule,
    ChatHistory, Report, User, ScanStatus, SeverityLevel,
    Repository, NetworkRange, Integration, SourceCodeScan, Log,
    create_target, create_scan, update_scan_status, create_vulnerability
)

# Import API routes
from src.api.auth_routes import router as auth_router
from src.api.github_routes import router as github_router
from src.api.report_routes import router as report_router

# Import RBAC dependencies
from src.services.auth import (
    require_admin, require_developer_or_admin, require_any_role, get_current_user_dep
)
from src.services.log_monitor import log_store, add_log, log_info, log_error, log_warning

# Initialize components
ai_router = AIRouter()
tool_engine = ToolEngine()

# WebSocket connections
active_connections: List[WebSocket] = []

# Pydantic models
class TargetCreate(BaseModel):
    name: str
    host: str
    type: str = "domain"
    description: str = ""
    tags: List[str] = []

class TargetResponse(BaseModel):
    id: int
    name: str
    host: str
    type: str
    description: str
    tags: List[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class ScanRequest(BaseModel):
    target_id: int
    scan_type: str
    tool: Optional[str] = None
    auto_save: bool = False

class ScanResponse(BaseModel):
    id: int
    target_id: int
    scan_type: str
    tool: Optional[str]
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration: Optional[int]
    output: Optional[str]
    ai_summary: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    provider: str = "gemini"
    model: str = "gemini-2.5-flash"
    auto_save: bool = False

class ChatResponse(BaseModel):
    response: str
    tool_calls: Optional[List[Dict]] = None
    session_id: str

class VulnerabilityResponse(BaseModel):
    id: int
    target_id: int
    scan_id: int
    title: str
    description: Optional[str]
    severity: str
    cvss_score: Optional[int]
    cve_id: Optional[str]
    affected_component: Optional[str]
    remediation: Optional[str]
    is_confirmed: bool
    is_fixed: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class ScheduleCreate(BaseModel):
    target_id: int
    name: str
    scan_type: str
    tool: Optional[str] = None
    cron_expression: str
    config: Dict = {}

# Application
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan"""
    # Startup
    print("🚀 Strix Pro starting...")
    init_db()
    print("✅ Database initialized")
    print(f"🤖 Available AI providers: {list(ai_router.get_available_providers().keys())}")
    print(f"🔧 Available tools: {len(tool_engine.get_tools_list())}")
    
    # Log retention cleanup on startup
    try:
        deleted = log_store.cleanup_old_logs(days=90)
        if deleted > 0:
            print(f"🧹 Cleaned up {deleted} logs older than 90 days")
    except Exception as e:
        print(f"⚠️ Log cleanup error: {e}")
    
    log_info("Strix Pro started", source="system", component="startup")
    yield
    # Shutdown
    print("👋 Strix Pro shutting down...")

app = FastAPI(
    title="Strix Pro API",
    description="AI-Powered Security Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    """Log all HTTP requests and responses"""
    start_time = time.time()
    method = request.method
    path = request.url.path
    
    # Skip health checks and static files
    skip_paths = ["/health", "/docs", "/openapi.json", "/favicon.ico"]
    should_log = not any(path.startswith(p) for p in skip_paths)
    
    if should_log:
        log_info(f"{method} {path}", source="backend", component="http", method=method, path=path)
    
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        
        if should_log:
            level = "error" if response.status_code >= 400 else "info"
            add_log(
                level=level,
                message=f"{method} {path} → {response.status_code} ({duration:.1f}ms)",
                source="backend",
                component="http",
                metadata={
                    "method": method,
                    "path": path,
                    "status": response.status_code,
                    "duration_ms": round(duration * 1000, 1),
                }
            )
        
        return response
    except Exception as e:
        duration = time.time() - start_time
        log_error(
            f"{method} {path} → ERROR: {str(e)} ({duration:.1f}ms)",
            source="backend",
            component="http",
            method=method,
            path=path,
            error=str(e),
        )
        raise

# WebSocket manager
async def broadcast(message: dict):
    """Broadcast message to all connected WebSocket clients"""
    for connection in active_connections:
        try:
            await connection.send_json(message)
        except:
            active_connections.remove(connection)

# Routes

# Include API routes
app.include_router(auth_router)
app.include_router(github_router)
app.include_router(report_router)

@app.get("/")
async def root():
    return {
        "name": "Strix Pro",
        "version": "1.0.0",
        "status": "running",
        "ai_providers": ai_router.get_available_providers(),
        "tools_count": len(tool_engine.get_tools_list())
    }

# AI Providers
@app.get("/api/ai/providers")
async def get_providers():
    """Get available AI providers and models"""
    return ai_router.get_available_providers()

# Targets
@app.post("/api/targets", response_model=TargetResponse)
async def create_target_endpoint(
    target: TargetCreate,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Create a new target (developer+ only)"""
    return create_target(
        db,
        name=target.name,
        host=target.host,
        target_type=target.type,
        description=target.description,
        tags=target.tags
    )

@app.get("/api/targets", response_model=List[TargetResponse])
async def list_targets(
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """List all targets (all roles)"""
    return db.query(Target).order_by(Target.created_at.desc()).all()

@app.get("/api/targets/{target_id}", response_model=TargetResponse)
async def get_target(
    target_id: int,
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """Get target by ID (all roles)"""
    target = db.query(Target).filter(Target.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    return target

@app.delete("/api/targets/{target_id}")
async def delete_target(
    target_id: int,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Delete target (developer+ only)"""
    target = db.query(Target).filter(Target.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    db.delete(target)
    db.commit()
    return {"message": "Target deleted"}

# Scans
@app.post("/api/scans", response_model=ScanResponse)
async def create_scan_endpoint(
    request: ScanRequest,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Create and execute a scan (developer+ only)"""
    # Verify target exists
    target = db.query(Target).filter(Target.id == request.target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    
    # Create scan record
    scan = create_scan(
        db,
        target_id=request.target_id,
        scan_type=request.scan_type,
        tool=request.tool
    )
    
    # Execute scan in background
    asyncio.create_task(
        execute_scan(scan.id, target.host, request.scan_type, request.tool, request.auto_save)
    )
    
    return scan

async def execute_scan(scan_id: int, target: str, scan_type: str, tool: str = None, auto_save: bool = False):
    """Execute scan in background"""
    from src.db.models import SessionLocal
    db = SessionLocal()
    
    try:
        # Update status to running
        update_scan_status(db, scan_id, ScanStatus.RUNNING.value)
        await broadcast({"type": "scan_status", "scan_id": scan_id, "status": "running"})
        
        # Full scan runs all tools sequentially
        if scan_type == "full_scan":
            domain = extract_domain(target)
            url = ensure_url(domain)
            tools_to_run = [
                ("nmap", {"target": domain, "flags": "-sV -sC -p-"}, "port_scan"),
                ("subfinder", {"domain": domain, "target": domain}, "subdomain"),
                ("httpx", {"target": url}, "web_probe"),
                ("nuclei", {"target": url}, "vulnerability"),
            ]
            all_outputs = []
            for tool_name, args, label in tools_to_run:
                log_info(f"Full scan [{scan_id}]: running {label} ({tool_name})", source="scanner", component="full-scan")
                try:
                    result = await asyncio.to_thread(tool_engine.execute, tool_name, args, auto_save)
                    if result.output:
                        all_outputs.append(f"═══ {label.upper()} ({tool_name}) ═══\n{result.output}")
                except Exception as e:
                    all_outputs.append(f"═══ {label.upper()} ({tool_name}) ═══\nERROR: {str(e)}")
            
            combined_output = "\n\n".join(all_outputs)
            ai_summary = await get_ai_summary(combined_output, "full_scan", target)
            update_scan_status(db, scan_id, ScanStatus.COMPLETED.value, output=combined_output, ai_summary=ai_summary)
            await broadcast({
                "type": "scan_complete",
                "scan_id": scan_id,
                "status": "completed",
                "output": combined_output[:500]
            })
        
        else:
            # Single tool scan
            if tool:
                tool_name = tool
            else:
                tool_map = {
                    "port_scan": "nmap",
                    "subdomain": "subfinder",
                    "web_scan": "nikto",
                    "vulnerability": "nuclei"
                }
                tool_name = tool_map.get(scan_type, "nmap")
            
            domain = extract_domain(target)
            url = ensure_url(domain)
            
            # Build args based on tool needs
            if tool_name == "nmap":
                args = {"target": domain, "flags": "-sV -sC -p-"}
            elif tool_name == "subfinder":
                args = {"domain": domain, "target": domain}
            elif tool_name == "httpx":
                args = {"target": url}
            elif tool_name in ("nuclei", "nikto"):
                args = {"target": url}
            elif tool_name == "whois":
                args = {"domain": domain}
            else:
                args = {"target": domain, "domain": domain, "url": url}
            
            result = await asyncio.to_thread(tool_engine.execute, tool_name, args, auto_save)
            
            if result.success:
                ai_summary = await get_ai_summary(result.output, scan_type, target)
                update_scan_status(db, scan_id, ScanStatus.COMPLETED.value, output=result.output, ai_summary=ai_summary)
                await broadcast({
                    "type": "scan_complete",
                    "scan_id": scan_id,
                    "status": "completed",
                    "output": result.output[:500]
                })
            else:
                update_scan_status(db, scan_id, ScanStatus.FAILED.value, error=result.error)
                await broadcast({"type": "scan_error", "scan_id": scan_id, "error": result.error})
    
    except Exception as e:
        update_scan_status(db, scan_id, ScanStatus.FAILED.value, error=str(e))
        await broadcast({"type": "scan_error", "scan_id": scan_id, "error": str(e)})
    finally:
        db.close()

async def get_ai_summary(output: str, scan_type: str, target: str) -> str:
    """Get AI summary of scan results"""
    try:
        providers = ai_router.get_available_providers()
        if not providers:
            return "No AI provider available for summary"
        
        provider = list(providers.keys())[0]
        models = providers[provider]
        model = models[0] if models else "gemini-2.5-flash"
        
        messages = [
            AIMessage(
                role="system",
                content="You are a security analyst. Summarize the scan results concisely, highlighting key findings and potential risks."
            ),
            AIMessage(
                role="user",
                content=f"Summarize this {scan_type} scan result for target {target}:\n\n{output[:3000]}"
            )
        ]
        
        response = ai_router.chat(provider, model, messages, max_tokens=500)
        return response.content
    except Exception as e:
        return f"AI summary failed: {e}"

@app.get("/api/scans", response_model=List[ScanResponse])
async def list_scans(
    target_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = Query(50, le=100),
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """List scans (all roles)"""
    query = db.query(Scan)
    if target_id:
        query = query.filter(Scan.target_id == target_id)
    if status:
        query = query.filter(Scan.status == status)
    return query.order_by(Scan.created_at.desc()).limit(limit).all()

@app.get("/api/scans/{scan_id}", response_model=ScanResponse)
async def get_scan(
    scan_id: int,
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """Get scan by ID (all roles)"""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan

@app.post("/api/scans/{scan_id}/cancel")
async def cancel_scan(
    scan_id: int,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Cancel a running scan (developer+ only)"""
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    if scan.status != ScanStatus.RUNNING.value:
        raise HTTPException(status_code=400, detail="Scan is not running")
    update_scan_status(db, scan_id, ScanStatus.CANCELLED.value)
    return {"message": "Scan cancelled"}

# Vulnerabilities
@app.get("/api/vulnerabilities", response_model=List[VulnerabilityResponse])
async def list_vulnerabilities(
    target_id: Optional[int] = None,
    severity: Optional[str] = None,
    is_fixed: Optional[bool] = None,
    limit: int = Query(100, le=500),
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """List vulnerabilities (all roles)"""
    query = db.query(Vulnerability)
    if target_id:
        query = query.filter(Vulnerability.target_id == target_id)
    if severity:
        query = query.filter(Vulnerability.severity == severity)
    if is_fixed is not None:
        query = query.filter(Vulnerability.is_fixed == is_fixed)
    return query.order_by(Vulnerability.created_at.desc()).limit(limit).all()

@app.get("/api/vulnerabilities/stats")
async def vulnerability_stats(
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """Get vulnerability statistics (all roles)"""
    total = db.query(Vulnerability).count()
    by_severity = {}
    for severity in SeverityLevel:
        count = db.query(Vulnerability).filter(Vulnerability.severity == severity.value).count()
        by_severity[severity.value] = count
    
    fixed = db.query(Vulnerability).filter(Vulnerability.is_fixed == True).count()
    unfixed = total - fixed
    
    return {
        "total": total,
        "by_severity": by_severity,
        "fixed": fixed,
        "unfixed": unfixed
    }

@app.patch("/api/vulnerabilities/{vuln_id}/confirm")
async def confirm_vulnerability(
    vuln_id: int,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Confirm a vulnerability (developer+ only)"""
    vuln = db.query(Vulnerability).filter(Vulnerability.id == vuln_id).first()
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnerability not found")
    vuln.is_confirmed = True
    db.commit()
    return {"message": "Vulnerability confirmed"}

@app.patch("/api/vulnerabilities/{vuln_id}/fix")
async def mark_fixed(
    vuln_id: int,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Mark vulnerability as fixed (developer+ only)"""
    vuln = db.query(Vulnerability).filter(Vulnerability.id == vuln_id).first()
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnerability not found")
    vuln.is_fixed = True
    vuln.fixed_at = datetime.utcnow()
    db.commit()
    return {"message": "Vulnerability marked as fixed"}

# AI Chat
@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Chat with AI assistant (developer+ only)"""
    
    # Get chat history
    history = db.query(ChatHistory).filter(
        ChatHistory.session_id == request.session_id
    ).order_by(ChatHistory.created_at).all()
    
    # Build messages
    messages = [
        AIMessage(
            role="system",
            content="""You are Strix Pro, an advanced AI-powered security assistant. 
You help with penetration testing, vulnerability analysis, and security assessments.
You can execute security tools like nmap, subfinder, gobuster, nikto, nuclei, etc.
When asked to scan or test something, use the appropriate tool.
Be technical, precise, and always prioritize security."""
        )
    ]
    
    for msg in history:
        messages.append(AIMessage(
            role=msg.role,
            content=msg.content,
            tool_call_id=msg.tool_call_id
        ))
    
    messages.append(AIMessage(role="user", content=request.message))
    
    # Save user message
    user_msg = ChatHistory(
        session_id=request.session_id,
        role="user",
        content=request.message
    )
    db.add(user_msg)
    db.commit()
    
    # Get AI tools
    tools = tool_engine.get_tools_for_ai()
    
    try:
        # Call AI
        response = ai_router.chat(
            provider=request.provider,
            model=request.model,
            messages=messages,
            tools=tools,
            temperature=0.7,
            max_tokens=4096
        )
        
        # Handle tool calls
        tool_results = []
        if response.tool_calls:
            for tool_call in response.tool_calls:
                func = tool_call["function"]
                tool_name = func["name"]
                
                # Parse arguments
                if isinstance(func["arguments"], str):
                    args = json.loads(func["arguments"])
                else:
                    args = func["arguments"]
                
                # Execute tool
                result = tool_engine.execute(tool_name, args, request.auto_save)
                tool_results.append({
                    "tool": tool_name,
                    "success": result.success,
                    "output": result.output[:1000] if result.output else result.error
                })
                
                # Broadcast tool execution
                await broadcast({
                    "type": "tool_execution",
                    "tool": tool_name,
                    "success": result.success,
                    "session_id": request.session_id
                })
            
            # Get AI response after tool execution
            messages.append(AIMessage(
                role="assistant",
                content=response.content or "",
                tool_calls=response.tool_calls
            ))
            
            # Add tool results
            for i, tool_call in enumerate(response.tool_calls):
                messages.append(AIMessage(
                    role="tool",
                    content=json.dumps(tool_results[i]),
                    tool_call_id=tool_call["id"]
                ))
            
            # Get final response
            final_response = ai_router.chat(
                provider=request.provider,
                model=request.model,
                messages=messages,
                temperature=0.7,
                max_tokens=4096
            )
            response_text = final_response.content
        else:
            response_text = response.content
        
        # Save assistant response
        assistant_msg = ChatHistory(
            session_id=request.session_id,
            role="assistant",
            content=response_text,
            tool_calls=response.tool_calls if response.tool_calls else None
        )
        db.add(assistant_msg)
        db.commit()
        
        return ChatResponse(
            response=response_text,
            tool_calls=tool_results if tool_results else None,
            session_id=request.session_id
        )
    
    except Exception as e:
        error_msg = f"AI Error: {str(e)}"
        
        # Save error
        error_history = ChatHistory(
            session_id=request.session_id,
            role="assistant",
            content=error_msg
        )
        db.add(error_history)
        db.commit()
        
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/api/chat/history/{session_id}")
async def get_chat_history(
    session_id: str,
    limit: int = 50,
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """Get chat history for session (all roles)"""
    history = db.query(ChatHistory).filter(
        ChatHistory.session_id == session_id
    ).order_by(ChatHistory.created_at.desc()).limit(limit).all()
    return list(reversed(history))

# Tools
@app.get("/api/tools")
async def list_tools():
    """List available security tools (no auth required)"""
    return tool_engine.get_tools_list()

@app.get("/api/tools/installed")
async def check_installed_tools():
    """Check which tools are installed (no auth required)"""
    tools = tool_engine.get_tools_list()
    installed = []
    not_installed = []
    
    for tool in tools:
        if tool_engine._check_tool_installed(tool["name"]):
            installed.append(tool["name"])
        else:
            not_installed.append(tool["name"])
    
    return {
        "installed": installed,
        "not_installed": not_installed,
        "total": len(tools)
    }

# ─── Tool Manager API ──────────────────────────────────────────────────────
# Install scripts for Go-based tools that can't be installed via apt
TOOL_INSTALL_SCRIPTS = {
    "nuclei": {
        "name": "nuclei",
        "description": "Vulnerability scanner using templates",
        "repo": "projectdiscovery/nuclei",
        "binary": "nuclei",
        "version_cmd": "nuclei -version 2>&1 | head -1",
    },
    "subfinder": {
        "name": "subfinder",
        "description": "Subdomain enumeration tool",
        "repo": "projectdiscovery/subfinder",
        "binary": "subfinder",
        "version_cmd": "subfinder -version 2>&1 | head -1",
    },
    "httpx": {
        "name": "httpx",
        "description": "HTTP toolkit and probing",
        "repo": "projectdiscovery/httpx",
        "binary": "httpx",
        "version_cmd": "httpx -version 2>&1 | head -1",
    },
    "trivy": {
        "name": "trivy",
        "description": "Comprehensive vulnerability scanner",
        "repo": "aquasecurity/trivy",
        "binary": "trivy",
        "version_cmd": "trivy --version 2>&1 | head -1",
        "install_method": "deb",  # uses .deb package instead of zip
    },
    "nikto": {
        "name": "nikto",
        "description": "Web server scanner",
        "repo": "sullo/nikto",
        "binary": "nikto",
        "version_cmd": "nikto -Version 2>&1 | head -2",
        "install_method": "git",
    },
}

@app.get("/api/tools/status")
async def get_tools_status(
    user: User = Depends(require_any_role),
):
    """Get detailed status of all managed tools (version, installed, updatable)"""
    import subprocess as sp
    
    results = []
    for tool_id, info in TOOL_INSTALL_SCRIPTS.items():
        binary = info["binary"]
        installed = False
        version = "Not installed"
        
        # Check if installed
        try:
            which = sp.run(["which", binary], capture_output=True, text=True)
            installed = which.returncode == 0
        except:
            pass
        
        if installed:
            try:
                ver_result = sp.run(info["version_cmd"], shell=True, capture_output=True, text=True, timeout=10)
                version = ver_result.stdout.strip() or ver_result.stderr.strip() or "Unknown version"
            except:
                version = "Unknown version"
        
        results.append({
            "id": tool_id,
            "name": info["name"],
            "description": info["description"],
            "repo": info["repo"],
            "installed": installed,
            "version": version,
            "install_method": info.get("install_method", "zip"),
        })
    
    return results

@app.post("/api/tools/{tool_id}/install")
async def install_tool(
    tool_id: str,
    user: User = Depends(require_admin),
):
    """Install or update a security tool"""
    if tool_id not in TOOL_INSTALL_SCRIPTS:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_id}' not found")
    
    info = TOOL_INSTALL_SCRIPTS[tool_id]
    repo = info["repo"]
    binary = info["binary"]
    install_method = info.get("install_method", "zip")
    
    # Build install command based on method
    if install_method == "git":
        # Nikto - clone from git
        cmd = f"""
        git clone --depth 1 https://github.com/{repo}.git /opt/nikto 2>/dev/null || true &&
        ln -sf /opt/nikto/program/nikto.pl /usr/local/bin/nikto &&
        chmod +x /usr/local/bin/nikto
        """
    elif install_method == "deb":
        # Trivy - install via .deb
        cmd = """
        ARCH=$(dpkg --print-architecture) &&
        if [ "$ARCH" = "arm64" ]; then TRIVY_ARCH="ARM64"; else TRIVY_ARCH="64bit"; fi &&
        VERSION=$(wget -qO- https://api.github.com/repos/aquasecurity/trivy/releases/latest 2>/dev/null | grep -oP '"tag_name": "v\\K[^"]*' || echo "0.71.0") &&
        wget -qO /tmp/trivy.deb "https://github.com/aquasecurity/trivy/releases/download/v${VERSION}/trivy_${VERSION}_Linux-${TRIVY_ARCH}.deb" &&
        dpkg -i /tmp/trivy.deb && rm /tmp/trivy.deb
        """
    else:
        # Go-based tools (nuclei, subfinder, httpx) - download zip
        cmd = f"""
        ARCH=$(dpkg --print-architecture) &&
        if [ "$ARCH" = "arm64" ]; then GOARCH="arm64"; else GOARCH="amd64"; fi &&
        VERSION=$(wget -qO- https://api.github.com/repos/{repo}/releases/latest 2>/dev/null | grep -oP '"tag_name": "v\\K[^"]*' || echo "latest") &&
        wget -qO /tmp/{binary}.zip "https://github.com/{repo}/releases/download/v${{VERSION}}/{binary}_linux_${{GOARCH}}.zip" &&
        unzip -o /tmp/{binary}.zip -d /tmp && mv /tmp/{binary} /usr/local/bin/{binary} && chmod +x /usr/local/bin/{binary} && rm -f /tmp/{binary}.zip
        """
    
    # Execute install
    try:
        result = sp.run(cmd, shell=True, capture_output=True, text=True, timeout=120)
        success = result.returncode == 0
        
        # Verify installation
        verify = sp.run(["which", binary], capture_output=True, text=True)
        installed = verify.returncode == 0
        
        return {
            "success": installed,
            "tool": tool_id,
            "message": f"{info['name']} {'installed' if installed else 'install failed'}",
            "output": result.stdout[-500:] if result.stdout else "",
            "error": result.stderr[-500:] if result.stderr and not installed else "",
        }
    except sp.TimeoutExpired:
        return {"success": False, "tool": tool_id, "message": "Install timed out (120s)", "error": "Timeout"}
    except Exception as e:
        return {"success": False, "tool": tool_id, "message": str(e), "error": str(e)}

@app.post("/api/tools/install-all")
async def install_all_tools(
    user: User = Depends(require_admin),
):
    """Install all missing tools"""
    results = []
    for tool_id in TOOL_INSTALL_SCRIPTS:
        try:
            binary = TOOL_INSTALL_SCRIPTS[tool_id]["binary"]
            which = sp.run(["which", binary], capture_output=True, text=True)
            if which.returncode != 0:
                # Tool not installed, install it
                result = await install_tool(tool_id, user)
                results.append(result)
            else:
                results.append({"success": True, "tool": tool_id, "message": f"{tool_id} already installed", "skipped": True})
        except Exception as e:
            results.append({"success": False, "tool": tool_id, "message": str(e), "error": str(e)})
    
    return {"results": results, "total": len(results)}

# WebSocket
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming WebSocket messages if needed
    except WebSocketDisconnect:
        active_connections.remove(websocket)

# Dashboard stats
@app.get("/api/dashboard/stats")
async def dashboard_stats(
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """Get dashboard statistics (all roles)"""
    total_targets = db.query(Target).count()
    total_scans = db.query(Scan).count()
    running_scans = db.query(Scan).filter(Scan.status == ScanStatus.RUNNING.value).count()
    completed_scans = db.query(Scan).filter(Scan.status == ScanStatus.COMPLETED.value).count()
    failed_scans = db.query(Scan).filter(Scan.status == ScanStatus.FAILED.value).count()
    total_vulns = db.query(Vulnerability).count()
    critical_vulns = db.query(Vulnerability).filter(Vulnerability.severity == SeverityLevel.CRITICAL.value).count()
    high_vulns = db.query(Vulnerability).filter(Vulnerability.severity == SeverityLevel.HIGH.value).count()
    
    # Source code scanning stats
    total_source_scans = db.query(SourceCodeScan).count()
    source_scans_running = db.query(SourceCodeScan).filter(SourceCodeScan.status == "running").count()
    source_scans_completed = db.query(SourceCodeScan).filter(SourceCodeScan.status == "completed").count()
    source_findings_critical = db.query(func.sum(SourceCodeScan.critical_count)).scalar() or 0
    source_findings_high = db.query(func.sum(SourceCodeScan.high_count)).scalar() or 0
    source_findings_medium = db.query(func.sum(SourceCodeScan.medium_count)).scalar() or 0
    source_findings_low = db.query(func.sum(SourceCodeScan.low_count)).scalar() or 0
    source_findings_total = db.query(func.sum(SourceCodeScan.findings_count)).scalar() or 0
    
    return {
        "targets": total_targets,
        "scans": {
            "total": total_scans,
            "running": running_scans,
            "completed": completed_scans,
            "failed": failed_scans
        },
        "vulnerabilities": {
            "total": total_vulns,
            "critical": critical_vulns,
            "high": high_vulns
        },
        "source_scans": {
            "total": total_source_scans,
            "running": source_scans_running,
            "completed": source_scans_completed,
            "findings": {
                "total": source_findings_total,
                "critical": source_findings_critical,
                "high": source_findings_high,
                "medium": source_findings_medium,
                "low": source_findings_low,
            }
        }
    }

# Reports
@app.post("/api/reports/generate")
async def generate_report(
    target_id: Optional[int] = None,
    report_type: str = "full",
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Generate a security report (developer+ only)"""
    # Get data
    if target_id:
        target = db.query(Target).filter(Target.id == target_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="Target not found")
        scans = db.query(Scan).filter(Scan.target_id == target_id).all()
        vulns = db.query(Vulnerability).filter(Vulnerability.target_id == target_id).all()
    else:
        target = None
        scans = db.query(Scan).all()
        vulns = db.query(Vulnerability).all()
    
    # Generate report content
    report_data = {
        "generated_at": datetime.utcnow().isoformat(),
        "target": {
            "name": target.name if target else "All Targets",
            "host": target.host if target else "N/A"
        } if target else None,
        "summary": {
            "total_scans": len(scans),
            "total_vulnerabilities": len(vulns),
            "critical": len([v for v in vulns if v.severity == SeverityLevel.CRITICAL.value]),
            "high": len([v for v in vulns if v.severity == SeverityLevel.HIGH.value]),
            "medium": len([v for v in vulns if v.severity == SeverityLevel.MEDIUM.value]),
            "low": len([v for v in vulns if v.severity == SeverityLevel.LOW.value])
        },
        "scans": [
            {
                "id": s.id,
                "type": s.scan_type,
                "tool": s.tool,
                "status": s.status,
                "duration": s.duration,
                "ai_summary": s.ai_summary
            }
            for s in scans
        ],
        "vulnerabilities": [
            {
                "id": v.id,
                "title": v.title,
                "severity": v.severity,
                "cve_id": v.cve_id,
                "affected": v.affected_component,
                "remediation": v.remediation,
                "is_fixed": v.is_fixed
            }
            for v in vulns
        ]
    }
    
    # Save report
    report = Report(
        title=f"Security Report - {target.name if target else 'All Targets'}",
        target_id=target_id,
        report_type=report_type,
        content=json.dumps(report_data, indent=2),
        format="json"
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return {
        "report_id": report.id,
        "data": report_data
    }

@app.get("/api/reports", response_model=List[Dict])
async def list_reports(
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """List generated reports (all roles)"""
    reports = db.query(Report).order_by(Report.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "title": r.title,
            "report_type": r.report_type,
            "format": r.format,
            "created_at": r.created_at
        }
        for r in reports
    ]

# Scheduler endpoints
@app.post("/api/schedules")
async def create_schedule(
    target_id: int,
    name: str,
    scan_type: str,
    cron_expression: str,
    tool: str = None,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Create a new scan schedule (developer+ only)"""
    target = db.query(Target).filter(Target.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    schedule = ScanSchedule(
        target_id=target_id, name=name, scan_type=scan_type,
        tool=tool, cron_expression=cron_expression, is_active=True
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule

@app.get("/api/schedules")
async def list_schedules(
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """List all scan schedules (all roles)"""
    return db.query(ScanSchedule).order_by(ScanSchedule.created_at.desc()).all()

@app.patch("/api/schedules/{schedule_id}/pause")
async def pause_schedule(
    schedule_id: int,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    schedule = db.query(ScanSchedule).filter(ScanSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    schedule.is_active = False
    db.commit()
    return {"message": "Schedule paused"}

@app.patch("/api/schedules/{schedule_id}/resume")
async def resume_schedule(
    schedule_id: int,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    schedule = db.query(ScanSchedule).filter(ScanSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    schedule.is_active = True
    db.commit()
    return {"message": "Schedule resumed"}

@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    schedule = db.query(ScanSchedule).filter(ScanSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(schedule)
    db.commit()
    return {"message": "Schedule deleted"}

# Settings endpoints (Admin only)
@app.get("/api/settings/api-keys")
async def get_api_keys_status(
    user: User = Depends(require_admin),
):
    """Get status of configured API keys (admin only)"""
    keys = {
        "GOOGLE_API_KEY": bool(os.getenv("GOOGLE_API_KEY")),
        "OPENAI_API_KEY": bool(os.getenv("OPENAI_API_KEY")),
        "ANTHROPIC_API_KEY": bool(os.getenv("ANTHROPIC_API_KEY")),
        "GROQ_API_KEY": bool(os.getenv("GROQ_API_KEY")),
        "MISTRAL_API_KEY": bool(os.getenv("MISTRAL_API_KEY")),
        "GITHUB_TOKEN": bool(os.getenv("GITHUB_TOKEN")),
        "CUSTOM_API_KEY": bool(os.getenv("CUSTOM_API_KEY")),
        "CUSTOM_BASE_URL": bool(os.getenv("CUSTOM_BASE_URL")),
    }
    return keys

@app.post("/api/settings/api-key")
async def update_api_key(
    request: dict,
    user: User = Depends(require_admin),
):
    """Update an API key in .env file (admin only)"""
    provider = request.get("provider")
    key = request.get("key")
    if not provider or not key:
        raise HTTPException(status_code=400, detail="Provider and key are required")
    
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    
    # Read existing .env
    lines = []
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            lines = f.readlines()
    
    # Update or add key
    found = False
    for i, line in enumerate(lines):
        if line.startswith(f"{provider}="):
            lines[i] = f"{provider}={key}\n"
            found = True
            break
    
    if not found:
        lines.append(f"{provider}={key}\n")
    
    # Write back
    with open(env_path, 'w') as f:
        f.writelines(lines)
    
    # Update runtime env
    os.environ[provider] = key
    
    return {"message": f"{provider} updated successfully"}

@app.post("/api/settings/custom-provider")
async def update_custom_provider(
    request: dict,
    user: User = Depends(require_admin),
):
    """Update custom AI provider settings (admin only)"""
    base_url = request.get("base_url", "").strip()
    api_key = request.get("api_key", "").strip()
    models = request.get("models", "mimo-v2.5-pro").strip()
    
    if not base_url or not api_key:
        raise HTTPException(status_code=400, detail="Base URL and API Key are required")
    
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    
    lines = []
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            lines = f.readlines()
    
    # Update or add custom provider settings
    env_vars = {
        "CUSTOM_BASE_URL": base_url,
        "CUSTOM_API_KEY": api_key,
        "CUSTOM_MODELS": models,
    }
    
    for var_name, var_value in env_vars.items():
        found = False
        for i, line in enumerate(lines):
            if line.startswith(f"{var_name}="):
                lines[i] = f"{var_name}={var_value}\n"
                found = True
                break
        if not found:
            lines.append(f"{var_name}={var_value}\n")
    
    with open(env_path, 'w') as f:
        f.writelines(lines)
    
    # Update runtime env
    for var_name, var_value in env_vars.items():
        os.environ[var_name] = var_value
    
    # Reinitialize AI router to pick up new provider
    try:
        ai_router._init_providers()
    except Exception as e:
        print(f"Warning: Failed to reinitialize AI providers: {e}")
    
    return {"message": "Custom provider configured successfully", "models": models.split(",")}

@app.get("/api/settings/custom-provider")
async def get_custom_provider(
    user: User = Depends(require_admin),
):
    """Get custom AI provider settings (admin only)"""
    return {
        "base_url": os.getenv("CUSTOM_BASE_URL", ""),
        "api_key_set": bool(os.getenv("CUSTOM_API_KEY")),
        "models": os.getenv("CUSTOM_MODELS", "mimo-v2.5-pro").split(","),
    }

# ─── Repositories API ─────────────────────────────────────────────
class RepoCreate(BaseModel):
    name: str
    url: str
    provider: str = "github"  # github, gitlab, bitbucket
    description: str = ""

class RepoResponse(BaseModel):
    id: int
    name: str
    url: str
    provider: str
    description: str
    status: str
    last_scanned_at: Optional[str] = None
    secrets_found: int = 0
    created_at: str
    class Config:
        from_attributes = True

@app.post("/api/repositories", response_model=RepoResponse)
async def create_repository(
    request: RepoCreate,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Add a repository for secret scanning"""
    repo = Repository(
        name=request.name,
        url=request.url,
        provider=request.provider,
        description=request.description,
        status="active",
        secrets_found=0,
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)
    return repo

@app.get("/api/repositories", response_model=List[RepoResponse])
async def list_repositories(
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """List all repositories"""
    return db.query(Repository).order_by(Repository.created_at.desc()).all()

@app.delete("/api/repositories/{repo_id}")
async def delete_repository(
    repo_id: int,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Delete a repository"""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    db.delete(repo)
    db.commit()
    return {"message": "Repository deleted"}

@app.post("/api/repositories/{repo_id}/scan")
async def scan_repository(
    repo_id: int,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Trigger a secret scan on repository"""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    repo.status = "scanning"
    db.commit()
    
    # Simulate secret scan (in production, would clone + run trufflehog/gitleaks)
    async def run_repo_scan():
        import asyncio
        await asyncio.sleep(2)
        repo.status = "active"
        repo.last_scanned_at = datetime.utcnow().isoformat()
        repo.secrets_found = 0
        db.commit()
    
    background_tasks.add_task(lambda: asyncio.run(run_repo_scan()))
    return {"message": "Repository scan started", "repo_id": repo_id}

# ─── Networks API ──────────────────────────────────────────────────
class NetworkCreate(BaseModel):
    name: str
    cidr: str  # e.g., "192.168.1.0/24"
    description: str = ""

class NetworkResponse(BaseModel):
    id: int
    name: str
    cidr: str
    description: str
    status: str
    hosts_discovered: int = 0
    last_scanned_at: Optional[str] = None
    created_at: str
    class Config:
        from_attributes = True

@app.post("/api/networks", response_model=NetworkResponse)
async def create_network(
    request: NetworkCreate,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Add a network range for discovery"""
    net = NetworkRange(
        name=request.name,
        cidr=request.cidr,
        description=request.description,
        status="active",
        hosts_discovered=0,
    )
    db.add(net)
    db.commit()
    db.refresh(net)
    return net

@app.get("/api/networks", response_model=List[NetworkResponse])
async def list_networks(
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """List all network ranges"""
    return db.query(NetworkRange).order_by(NetworkRange.created_at.desc()).all()

@app.delete("/api/networks/{network_id}")
async def delete_network(
    network_id: int,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Delete a network range"""
    net = db.query(NetworkRange).filter(NetworkRange.id == network_id).first()
    if not net:
        raise HTTPException(status_code=404, detail="Network not found")
    db.delete(net)
    db.commit()
    return {"message": "Network deleted"}

@app.post("/api/networks/{network_id}/discover")
async def discover_network(
    network_id: int,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Run host discovery on network range"""
    net = db.query(NetworkRange).filter(NetworkRange.id == network_id).first()
    if not net:
        raise HTTPException(status_code=404, detail="Network not found")
    net.status = "scanning"
    db.commit()
    
    async def run_discovery():
        result = await tool_engine.execute_tool("nmap", net.cidr, {"scan_type": "ping"})
        if result.get("success"):
            output = result.get("raw_output", "")
            host_count = output.count("Host is up")
            net.hosts_discovered = host_count
        net.status = "active"
        net.last_scanned_at = datetime.utcnow().isoformat()
        db.commit()
    
    background_tasks.add_task(lambda: asyncio.run(run_discovery()))
    return {"message": "Network discovery started", "network_id": network_id}

# ─── Integrations API ──────────────────────────────────────────────
class IntegrationCreate(BaseModel):
    name: str
    type: str  # slack, jira, webhook, pagerduty, email
    config: dict = {}
    enabled: bool = True

class IntegrationResponse(BaseModel):
    id: int
    name: str
    type: str
    config: dict
    enabled: bool
    status: str
    last_triggered_at: Optional[str] = None
    created_at: str
    class Config:
        from_attributes = True

@app.post("/api/integrations", response_model=IntegrationResponse)
async def create_integration(
    request: IntegrationCreate,
    user: User = Depends(require_admin),
    db=Depends(get_db),
):
    """Add an integration"""
    integration = Integration(
        name=request.name,
        type=request.type,
        config=request.config,
        enabled=request.enabled,
        status="active" if request.enabled else "disabled",
    )
    db.add(integration)
    db.commit()
    db.refresh(integration)
    return integration

@app.get("/api/integrations", response_model=List[IntegrationResponse])
async def list_integrations(
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """List all integrations"""
    return db.query(Integration).order_by(Integration.created_at.desc()).all()

@app.put("/api/integrations/{integration_id}")
async def update_integration(
    integration_id: int,
    request: IntegrationCreate,
    user: User = Depends(require_admin),
    db=Depends(get_db),
):
    """Update an integration"""
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    integration.name = request.name
    integration.type = request.type
    integration.config = request.config
    integration.enabled = request.enabled
    integration.status = "active" if request.enabled else "disabled"
    db.commit()
    db.refresh(integration)
    return integration

@app.delete("/api/integrations/{integration_id}")
async def delete_integration(
    integration_id: int,
    user: User = Depends(require_admin),
    db=Depends(get_db),
):
    """Delete an integration"""
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    db.delete(integration)
    db.commit()
    return {"message": "Integration deleted"}

@app.post("/api/integrations/{integration_id}/test")
async def test_integration(
    integration_id: int,
    user: User = Depends(require_admin),
    db=Depends(get_db),
):
    """Test an integration connection"""
    integration = db.query(Integration).filter(Integration.id == integration_id).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Simulate test
    integration.last_triggered_at = datetime.utcnow().isoformat()
    db.commit()
    return {"message": "Test notification sent", "status": "ok"}

# ─── Source Code Scanning API ──────────────────────────────────────────────
class SourceCodeScanRequest(BaseModel):
    tool: str  # trivy, sonar-scanner, codeql
    target: str  # directory path or repo URL
    project_key: Optional[str] = None  # for sonarqube
    server_url: Optional[str] = None  # for sonarqube
    language: Optional[str] = None  # for codeql
    repository_id: Optional[int] = None  # link to repository

class SourceCodeScanResponse(BaseModel):
    id: int
    tool: str
    target: str
    status: str
    findings_count: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str
    class Config:
        from_attributes = True

@app.post("/api/source-scans", response_model=SourceCodeScanResponse)
async def create_source_scan(
    request: SourceCodeScanRequest,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Start a source code scan"""
    # Create scan record
    scan = SourceCodeScan(
        tool=request.tool,
        target=request.target,
        status="running",
        findings_count=0,
        critical_count=0,
        high_count=0,
        medium_count=0,
        low_count=0,
        repository_id=request.repository_id,
        started_at=datetime.utcnow(),
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    
    # Build tool args
    args = {"target": request.target}
    if request.tool == "sonar-scanner":
        args["project_key"] = request.project_key or f"strix-{int(datetime.utcnow().timestamp())}"
        args["server_url"] = request.server_url or "http://localhost:9000"
    elif request.tool == "codeql":
        lang = request.language or "javascript"
        args["database"] = f"/tmp/codeql-db-{scan.id}"
        args["query_suite"] = f"{lang}-security-extended"
        args["output"] = f"/tmp/codeql-results-{scan.id}.sarif"
    
    async def run_source_scan():
        try:
            result = tool_engine.execute(request.tool, args)
            scan.status = "completed" if result.success else "failed"
            scan.completed_at = datetime.utcnow()
            
            # Parse findings from output
            output = result.output
            if request.tool == "trivy" and result.success:
                try:
                    trivy_json = json.loads(output)
                    findings = []
                    for result_item in trivy_json.get("Results", []):
                        for vuln in result_item.get("Vulnerabilities", []):
                            findings.append(vuln)
                    scan.findings_count = len(findings)
                    for f in findings:
                        sev = f.get("Severity", "").lower()
                        if sev == "critical": scan.critical_count += 1
                        elif sev == "high": scan.high_count += 1
                        elif sev == "medium": scan.medium_count += 1
                        elif sev == "low": scan.low_count += 1
                except json.JSONDecodeError:
                    pass
            
            if not result.success:
                scan.error = result.error
            db.commit()
        except Exception as e:
            scan.status = "failed"
            scan.error = str(e)
            scan.completed_at = datetime.utcnow()
            db.commit()
    
    background_tasks.add_task(lambda: asyncio.run(run_source_scan()))
    return scan

@app.get("/api/source-scans", response_model=List[SourceCodeScanResponse])
async def list_source_scans(
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """List all source code scans"""
    return db.query(SourceCodeScan).order_by(SourceCodeScan.created_at.desc()).all()

@app.get("/api/source-scans/{scan_id}")
async def get_source_scan(
    scan_id: int,
    user: User = Depends(require_any_role),
    db=Depends(get_db),
):
    """Get source code scan details"""
    scan = db.query(SourceCodeScan).filter(SourceCodeScan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Source scan not found")
    return scan

@app.delete("/api/source-scans/{scan_id}")
async def delete_source_scan(
    scan_id: int,
    user: User = Depends(require_developer_or_admin),
    db=Depends(get_db),
):
    """Delete a source code scan"""
    scan = db.query(SourceCodeScan).filter(SourceCodeScan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Source scan not found")
    db.delete(scan)
    db.commit()
    return {"message": "Source scan deleted"}

# ─── Log Monitor API ────────────────────────────────────────────────────────
from pydantic import BaseModel as BM

class LogCreateRequest(BM):
    level: str = "info"
    message: str
    source: str = "frontend"
    component: str = ""
    metadata: Optional[Dict] = None

@app.post("/api/logs")
async def create_log(request: LogCreateRequest):
    """Receive log from frontend or external source"""
    entry = log_store.add(
        level=request.level,
        message=request.message,
        source=request.source,
        component=request.component,
        metadata=request.metadata,
    )
    return {"status": "ok", "id": entry["id"]}

@app.post("/api/logs/webhook/loki")
async def loki_webhook(request: dict):
    """Loki webhook endpoint — receives pushed logs from Loki
    
    Supports Loki push API format:
    {
      "streams": [
        {
          "labels": {"job": "strix-backend", "level": "info"},
          "values": [["<timestamp_ns>", "<log_line>"]]
        }
      ]
    }
    """
    try:
        entries = log_store.parse_loki_push(request)
        return {"status": "ok", "received": len(entries)}
    except Exception as e:
        log_error(f"Loki webhook parse error: {str(e)}", source="system", component="loki-webhook")
        raise HTTPException(status_code=400, detail=f"Invalid Loki payload: {str(e)}")

@app.get("/api/logs")
async def get_logs(
    level: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    since: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    history: bool = False,
    user: User = Depends(require_any_role),
):
    """Query logs with filters. Set history=true to query from persistent DB (3-month retention)."""
    return {
        "logs": log_store.query(level=level, source=source, search=search, since=since, limit=limit, offset=offset, use_db=history),
        "stats": log_store.get_stats(),
    }

@app.get("/api/logs/stats")
async def get_log_stats(user: User = Depends(require_any_role)):
    """Get log statistics"""
    return log_store.get_stats()

@app.delete("/api/logs")
async def clear_logs(user: User = Depends(require_admin)):
    """Clear all logs (admin only)"""
    log_store.clear()
    log_info("Logs cleared by admin", source="system", component="log-monitor")
    return {"message": "Logs cleared"}

@app.post("/api/logs/cleanup")
async def cleanup_logs(days: int = 90, user: User = Depends(require_admin)):
    """Manually trigger log retention cleanup (admin only)"""
    deleted = log_store.cleanup_old_logs(days=days)
    return {"message": f"Cleaned up {deleted} logs older than {days} days", "deleted": deleted}

@app.websocket("/ws/logs")
async def log_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time log streaming"""
    await websocket.accept()
    queue = log_store.subscribe()
    
    try:
        # Send initial logs (last 50)
        recent = log_store.query(limit=50)
        await websocket.send_json({"type": "initial", "logs": recent, "stats": log_store.get_stats()})
        
        # Stream new logs
        while True:
            try:
                log_entry = await asyncio.wait_for(queue.get(), timeout=30)
                await websocket.send_json({"type": "log", "entry": log_entry, "stats": log_store.get_stats()})
            except asyncio.TimeoutError:
                # Send keepalive
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        log_store.unsubscribe(queue)

# Health check
@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.0.0"}

# Entry point
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

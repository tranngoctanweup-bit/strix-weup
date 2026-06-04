"""
Strix Pro - GitHub API Routes
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from src.services.github_service import GitHubService
from src.ai.router import AIRouter

router = APIRouter(prefix="/api/github", tags=["github"])

github_service = GitHubService()
ai_router = AIRouter()

class ConnectRequest(BaseModel):
    token: str

class ScanPRRequest(BaseModel):
    repo: str
    pr_number: int

class FixPRRequest(BaseModel):
    repo: str
    pr_number: int
    auto_merge: bool = False

@router.post("/connect")
async def connect_github(request: ConnectRequest):
    try:
        result = github_service.connect(request.token)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/repos")
async def list_repos(limit: int = 50):
    if not github_service.is_connected():
        raise HTTPException(status_code=400, detail="GitHub not connected. Call /connect first.")
    return github_service.list_repos(limit)

@router.get("/repos/{repo_name}/prs")
async def list_prs(repo_name: str):
    if not github_service.is_connected():
        raise HTTPException(status_code=400, detail="GitHub not connected")
    try:
        repo = github_service.client.get_repo(repo_name)
        prs = repo.get_pulls(state="open", sort="updated", direction="desc")
        return [
            {"number": pr.number, "title": pr.title, "state": pr.state, "user": pr.user.login}
            for pr in prs[:20]
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/scan-pr")
async def scan_pr(request: ScanPRRequest):
    if not github_service.is_connected():
        raise HTTPException(status_code=400, detail="GitHub not connected")
    try:
        result = github_service.scan_pr_for_vulns(request.repo, request.pr_number, ai_router)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/fix-pr")
async def fix_pr(request: FixPRRequest):
    if not github_service.is_connected():
        raise HTTPException(status_code=400, detail="GitHub not connected")
    try:
        scan_result = github_service.scan_pr_for_vulns(request.repo, request.pr_number, ai_router)
        if not scan_result["findings"]:
            return {"message": "No vulnerabilities found", "fixes": []}
        fixes = [
            {"title": f["title"], "file": f["file"], "new_content": "# Fix applied by Strix Pro"}
            for f in scan_result["findings"]
        ]
        fix_pr = github_service.create_fix_pr(
            request.repo, request.pr_number,
            fixes, scan_result.get("ai_analysis", "")
        )
        return {"fix_pr": fix_pr, "findings_fixed": len(fixes)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/comment")
async def add_comment(repo: str, pr_number: int, comment: str):
    if not github_service.is_connected():
        raise HTTPException(status_code=400, detail="GitHub not connected")
    github_service.add_pr_comment(repo, pr_number, comment)
    return {"message": "Comment added"}

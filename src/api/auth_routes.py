"""
Strix Pro - Auth API Routes
Includes user management endpoints (admin only)
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from src.db.models import get_db, User
from src.services.auth import (
    authenticate_user, register_user, create_access_token,
    create_refresh_token, decode_token, get_current_user,
    require_admin, require_any_role, get_current_user_dep,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ─── Request / Response Models ───────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool

class RoleUpdateRequest(BaseModel):
    role: str


# ─── Auth Endpoints ──────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, request.email, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        },
    )

@router.post("/register", response_model=UserResponse)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    try:
        user = register_user(db, request.name, request.email, request.password, role="viewer")
        return UserResponse(id=user.id, name=user.name, email=user.email, role=user.role, is_active=user.is_active)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/refresh", response_model=TokenResponse)
async def refresh(refresh_token: str, db: Session = Depends(get_db)):
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access_token = create_access_token({"sub": user_id})
    new_refresh = create_refresh_token({"sub": user_id})
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        },
    )

@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user_dep)):
    return UserResponse(id=user.id, name=user.name, email=user.email, role=user.role, is_active=user.is_active)


# ─── User Management (Admin Only) ───────────────────────────────────────────

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users (admin only)"""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [UserResponse(id=u.id, name=u.name, email=u.email, role=u.role, is_active=u.is_active) for u in users]


@router.patch("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    request: RoleUpdateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Change a user's role (admin only)"""
    if request.role not in ("admin", "developer", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be admin, developer, or viewer")
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    target_user.role = request.role
    db.commit()
    db.refresh(target_user)
    return UserResponse(id=target_user.id, name=target_user.name, email=target_user.email, role=target_user.role, is_active=target_user.is_active)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a user (admin only)"""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    if target_user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.delete(target_user)
    db.commit()
    return {"message": "User deleted"}

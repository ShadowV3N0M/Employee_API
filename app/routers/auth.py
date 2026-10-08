"""Authentication and User Management router."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_admin, VALID_ROLES
from app.auth.security import hash_password, verify_password, create_access_token
from app.config import (
    EMAIL_DOMAIN,
    FRONTEND_URL,
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    SMTP_HOST,
    SMTP_PASSWORD,
    limiter,
)
from app.database import get_db
from app.models.employee import EmployeeDB
from app.models.user import UserDB, PasswordResetTokenDB
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordConfirm,
    RoleUpdate,
    Token,
    UserCreateAdmin,
    UserRegister,
    UserStatusUpdate,
)
from app.services.email_service import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["Authentication & Users"])


@router.post("/register", response_model=Token)
@limiter.limit("5/minute")
def register(request: Request, user: UserRegister, db: Session = Depends(get_db)):
    """Public registration. Creates a plain 'user' account."""
    try:
        existing = db.query(UserDB).filter(
            UserDB.username == user.username).first()
        if existing:
            raise HTTPException(
                status_code=409, detail="Username already taken")

        cleaned_email = user.email.strip().lower() if user.email else None
        if cleaned_email:
            existing_email = db.query(UserDB).filter(
                UserDB.email == cleaned_email).first()
            if existing_email:
                raise HTTPException(
                    status_code=409, detail="Email already registered")

        # Auto-link to existing employee record if matching
        matched_emp = None
        if cleaned_email:
            matched_emp = db.query(EmployeeDB).filter(
                func.lower(EmployeeDB.Email) == cleaned_email
            ).first()
        if not matched_emp and user.username:
            u_clean = user.username.strip().lower()
            matched_emp = db.query(EmployeeDB).filter(
                or_(
                    func.lower(EmployeeDB.F_Name) == u_clean,
                    func.lower(func.concat(EmployeeDB.F_Name, " ", EmployeeDB.L_Name)) == u_clean,
                    func.lower(EmployeeDB.Email) == u_clean,
                    EmployeeDB.Email.ilike(f"{u_clean}@%"),
                )
            ).first()

        new_user = UserDB(
            username=user.username,
            email=cleaned_email,
            hashed_password=hash_password(user.password),
            role="user",
            emp_id=matched_emp.Emp_ID if matched_emp else None
        )
        db.add(new_user)
        db.commit()

        token = create_access_token(
            {"sub": new_user.username, "role": new_user.role})
        return Token(access_token=token)

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """OAuth2 password login. Returns a JWT Bearer token."""
    try:
        user = db.query(UserDB).filter(
            UserDB.username == form_data.username).first()
        if not user or not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = create_access_token({"sub": user.username, "role": user.role})
        return Token(access_token=token)

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Authentication error: {str(e)}")


@router.get("/me")
def get_current_user_profile(current_user: UserDB = Depends(get_current_user)):
    """Returns the profile of the currently authenticated user."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active
    }


@router.post("/forgot-password")
@limiter.limit("5/minute")
def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """Request a password reset link by username or email."""
    try:
        ident = payload.identifier.strip().lower()
        user = db.query(UserDB).filter(
            (UserDB.username == payload.identifier.strip()) | (
                UserDB.email == ident)
        ).first()

        raw_token = None
        if user and user.is_active:
            db.query(PasswordResetTokenDB).filter(
                PasswordResetTokenDB.user_id == user.id,
                PasswordResetTokenDB.used == False
            ).update({"used": True})

            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
            expires_at = datetime.now(
                timezone.utc) + timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)

            reset_record = PasswordResetTokenDB(
                user_id=user.id,
                token_hash=token_hash,
                expires_at=expires_at,
                used=False
            )
            db.add(reset_record)
            db.commit()

            recipient = user.email or f"{user.username}@{EMAIL_DOMAIN}"
            send_password_reset_email(recipient, user.username, raw_token)

        response = {
            "message": "If an account matching that username or email exists, a password reset link has been sent."
        }
        if (not SMTP_HOST or not SMTP_PASSWORD) and raw_token:
            response["debug_token"] = raw_token
            response["debug_url"] = f"{FRONTEND_URL}/reset-password?token={raw_token}"

        return response

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.get("/verify-reset-token")
def verify_reset_token(token: str, db: Session = Depends(get_db)):
    """Validates if a reset token is active and unexpired."""
    try:
        token_hash = hashlib.sha256(token.strip().encode()).hexdigest()
        record = db.query(PasswordResetTokenDB).filter(
            PasswordResetTokenDB.token_hash == token_hash,
            PasswordResetTokenDB.used == False
        ).first()

        if not record:
            raise HTTPException(
                status_code=400, detail="Invalid or expired reset token")

        exp = record.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)

        if exp < datetime.now(timezone.utc):
            record.used = True
            db.commit()
            raise HTTPException(
                status_code=400, detail="Reset token has expired")

        user = db.query(UserDB).filter(UserDB.id == record.user_id).first()
        return {"valid": True, "username": user.username if user else None}

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.post("/reset-password")
@limiter.limit("5/minute")
def reset_password(
    request: Request,
    payload: ResetPasswordConfirm,
    db: Session = Depends(get_db)
):
    """Reset password using a valid token."""
    try:
        if len(payload.new_password) < 6:
            raise HTTPException(
                status_code=400, detail="Password must be at least 6 characters long")

        token_hash = hashlib.sha256(payload.token.strip().encode()).hexdigest()
        record = db.query(PasswordResetTokenDB).filter(
            PasswordResetTokenDB.token_hash == token_hash,
            PasswordResetTokenDB.used == False
        ).first()

        if not record:
            raise HTTPException(
                status_code=400, detail="Invalid or expired reset token")

        exp = record.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)

        if exp < datetime.now(timezone.utc):
            record.used = True
            db.commit()
            raise HTTPException(
                status_code=400, detail="Reset token has expired")

        user = db.query(UserDB).filter(UserDB.id == record.user_id).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=400, detail="User account is inactive or not found")

        user.hashed_password = hash_password(payload.new_password)
        record.used = True
        db.commit()

        return {"message": "Password reset successfully. You can now log in with your new password."}

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


USER_SORTABLE = {
    "id": UserDB.id,
    "username": UserDB.username,
    "email": UserDB.email,
    "role": UserDB.role,
    "is_active": UserDB.is_active,
}


@router.get("/users")
def list_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    sort_by: str = "id",
    order: str = "asc",
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. List all users with optional filtering by query, role, and active status, and sorting."""
    try:
        query = db.query(UserDB)

        if search and search.strip():
            s = search.strip()
            conds = [
                UserDB.username.ilike(f"%{s}%"),
                UserDB.email.ilike(f"%{s}%")
            ]
            if s.isdigit():
                conds.append(UserDB.id == int(s))
            query = query.filter(or_(*conds))

        if role and role.strip() and role.strip().lower() != "all":
            query = query.filter(UserDB.role == role.strip().lower())

        if is_active is not None:
            query = query.filter(UserDB.is_active == is_active)

        col = USER_SORTABLE.get(sort_by, UserDB.id)
        users = query.order_by(col.desc() if order == "desc" else col.asc()).all()
        return [
            {"id": u.id, "username": u.username, "email": u.email,
             "role": u.role, "is_active": u.is_active, "emp_id": u.emp_id}
            for u in users
        ]
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.post("/users")
@limiter.limit("10/minute")
def create_user_by_admin(
    request: Request,
    payload: UserCreateAdmin,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. Create a new user with a designated role (user, manager, admin)."""
    uname = payload.username.strip()
    if len(uname) < 3:
        raise HTTPException(
            status_code=400, detail="Username must be at least 3 characters long")
    if len(payload.password) < 6:
        raise HTTPException(
            status_code=400, detail="Password must be at least 6 characters long")

    role = (payload.role or "user").strip().lower()
    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=400, detail=f"Role must be one of: {sorted(VALID_ROLES)}")

    existing = db.query(UserDB).filter(UserDB.username == uname).first()
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Username '{uname}' already exists")

    try:
        user_email = payload.email.strip().lower() if payload.email and payload.email.strip() else None

        # Auto-link to existing employee record if matching
        matched_emp = None
        if user_email:
            matched_emp = db.query(EmployeeDB).filter(
                func.lower(EmployeeDB.Email) == user_email
            ).first()
        if not matched_emp and uname:
            u_clean = uname.lower()
            matched_emp = db.query(EmployeeDB).filter(
                or_(
                    func.lower(EmployeeDB.F_Name) == u_clean,
                    func.lower(func.concat(EmployeeDB.F_Name, " ", EmployeeDB.L_Name)) == u_clean,
                    func.lower(EmployeeDB.Email) == u_clean,
                    EmployeeDB.Email.ilike(f"{u_clean}@%"),
                )
            ).first()

        new_user = UserDB(
            username=uname,
            hashed_password=hash_password(payload.password),
            email=user_email,
            role=role,
            is_active=True,
            emp_id=matched_emp.Emp_ID if matched_emp else None
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {
            "message": f"User '{new_user.username}' created successfully as '{new_user.role}'",
            "user": {
                "id": new_user.id,
                "username": new_user.username,
                "email": new_user.email,
                "role": new_user.role,
                "is_active": new_user.is_active,
                "emp_id": new_user.emp_id,
            }
        }
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.put("/users/{username}/role")
@limiter.limit("10/minute")
def change_user_role(
    request: Request,
    username: str,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. Promote or demote user roles."""
    try:
        if payload.role not in VALID_ROLES:
            raise HTTPException(
                status_code=400, detail=f"role must be one of: {sorted(VALID_ROLES)}")

        if username == current_user.username:
            raise HTTPException(
                status_code=400,
                detail="You cannot change your own role (prevents locking out the last admin)"
            )

        target = db.query(UserDB).filter(UserDB.username == username).first()
        if target is None:
            raise HTTPException(status_code=404, detail="User not found")

        target.role = payload.role
        db.commit()
        return {"message": f"'{username}' is now '{payload.role}'"}

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.put("/change-password")
@limiter.limit("5/minute")
def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Any authenticated user. Change their own account password."""
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400, detail="Incorrect current password")

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=400, detail="New password must be at least 6 characters")

    try:
        current_user.hashed_password = hash_password(payload.new_password)
        db.commit()
        return {"message": "Password changed successfully"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.put("/users/{username}/status")
@limiter.limit("10/minute")
def change_user_status(
    request: Request,
    username: str,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. Activate or deactivate a user account."""
    if username == current_user.username:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account"
        )

    target = db.query(UserDB).filter(UserDB.username == username).first()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        target.is_active = payload.is_active
        db.commit()
        action = "activated" if payload.is_active else "deactivated"
        return {"message": f"User '{username}' account {action} successfully", "is_active": target.is_active}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.delete("/users/{username}")
@limiter.limit("10/minute")
def delete_user(
    request: Request,
    username: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. Permanently delete a user account."""
    target = db.query(UserDB).filter(UserDB.username == username).first()
    if target is None and username.isdigit():
        target = db.query(UserDB).filter(UserDB.id == int(username)).first()

    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    if target.username == current_user.username or target.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account"
        )

    try:
        # Explicitly delete any password reset tokens associated with this user
        db.query(PasswordResetTokenDB).filter(
            PasswordResetTokenDB.user_id == target.id).delete()
        
        target_name = target.username
        db.delete(target)
        db.commit()
        return {"message": f"User '{target_name}' permanently deleted"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")

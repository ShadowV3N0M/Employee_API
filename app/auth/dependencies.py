"""FastAPI authentication and role-based authorization dependencies."""
from fastapi import Depends, HTTPException, status
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.auth.security import oauth2_scheme
from app.config import SECRET_KEY, ALGORITHM
from app.database import get_db
from app.models.user import UserDB

VALID_ROLES = {"user", "manager", "admin"}


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> UserDB:
    """Validate Bearer JWT and retrieve user from database."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(UserDB).filter(UserDB.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exception

    return user


def require_roles(*allowed_roles: str):
    """
    Dependency factory. Usage:
        Depends(require_roles("manager", "admin"))
    Returns 401 if not authenticated, 403 if user lacks required role.
    """
    def checker(current_user: UserDB = Depends(get_current_user)) -> UserDB:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {' or '.join(allowed_roles)}"
            )
        return current_user

    return checker


require_admin = require_roles("admin")
require_manager_or_admin = require_roles("manager", "admin")

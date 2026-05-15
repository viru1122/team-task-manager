from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import decode_token
from app import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if not payload:
        raise credentials_exception
    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if not user:
        raise credentials_exception
    return user


def require_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != models.RoleEnum.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_project_access(project_id: int, user: models.User, db: Session, admin_only: bool = False):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project.owner_id == user.id
    is_admin = user.role == models.RoleEnum.admin
    is_member = user in project.members

    if admin_only and not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Only project owner or admin can perform this action")

    if not (is_owner or is_admin or is_member):
        raise HTTPException(status_code=403, detail="You don't have access to this project")

    return project
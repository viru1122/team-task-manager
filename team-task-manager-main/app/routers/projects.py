from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api/projects", tags=["Projects"])


@router.post("/", response_model=schemas.ProjectOut, status_code=201)
def create_project(
    payload: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = models.Project(
        name=payload.name,
        description=payload.description,
        owner_id=current_user.id,
    )
    project.members.append(current_user)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/", response_model=List[schemas.ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == models.RoleEnum.admin:
        return db.query(models.Project).all()
    owned = current_user.owned_projects
    member_of = current_user.projects
    seen = {p.id: p for p in owned}
    for p in member_of:
        seen[p.id] = p
    return list(seen.values())


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return require_project_access(project_id, current_user, db)


@router.put("/{project_id}", response_model=schemas.ProjectOut)
def update_project(
    project_id: int,
    payload: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = require_project_access(project_id, current_user, db, admin_only=True)
    project.name = payload.name
    project.description = payload.description
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = require_project_access(project_id, current_user, db, admin_only=True)
    db.delete(project)
    db.commit()


@router.post("/{project_id}/members", response_model=schemas.ProjectOut)
def add_member(
    project_id: int,
    payload: schemas.AddMember,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = require_project_access(project_id, current_user, db, admin_only=True)
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user in project.members:
        raise HTTPException(status_code=400, detail="User already a member")
    project.members.append(user)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}/members/{user_id}", response_model=schemas.ProjectOut)
def remove_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = require_project_access(project_id, current_user, db, admin_only=True)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or user not in project.members:
        raise HTTPException(status_code=404, detail="Member not found")
    if user.id == project.owner_id:
        raise HTTPException(status_code=400, detail="Cannot remove project owner")
    project.members.remove(user)
    db.commit()
    db.refresh(project)
    return project
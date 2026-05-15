from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from datetime import datetime
from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user, require_project_access

router = APIRouter(prefix="/api", tags=["Tasks"])


@router.post("/projects/{project_id}/tasks", response_model=schemas.TaskOut, status_code=201)
def create_task(
    project_id: int,
    payload: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = require_project_access(project_id, current_user, db)

    if payload.assignee_id:
        assignee = db.query(models.User).filter(models.User.id == payload.assignee_id).first()
        if not assignee or assignee not in project.members:
            raise HTTPException(status_code=400, detail="Assignee must be a project member")

    task = models.Task(
        title=payload.title,
        description=payload.description,
        status=payload.status or models.TaskStatus.todo,
        priority=payload.priority or models.TaskPriority.medium,
        due_date=payload.due_date,
        assignee_id=payload.assignee_id,
        project_id=project_id,
        created_by=current_user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/projects/{project_id}/tasks", response_model=List[schemas.TaskOut])
def list_project_tasks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    require_project_access(project_id, current_user, db)
    return db.query(models.Task).filter(models.Task.project_id == project_id).all()


@router.get("/tasks/{task_id}", response_model=schemas.TaskOut)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    require_project_access(task.project_id, current_user, db)
    return task


@router.put("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(
    task_id: int,
    payload: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project = require_project_access(task.project_id, current_user, db)

    is_owner_or_admin = (project.owner_id == current_user.id) or (current_user.role == models.RoleEnum.admin)
    if not is_owner_or_admin:
        if task.assignee_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can only update tasks assigned to you")
        update_data = payload.model_dump(exclude_unset=True)
        if set(update_data.keys()) - {"status"}:
            raise HTTPException(status_code=403, detail="Members can only update task status")

    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "assignee_id" and value is not None:
            assignee = db.query(models.User).filter(models.User.id == value).first()
            if not assignee or assignee not in project.members:
                raise HTTPException(status_code=400, detail="Assignee must be a project member")
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    project = require_project_access(task.project_id, current_user, db, admin_only=True)
    db.delete(task)
    db.commit()


@router.get("/dashboard", response_model=schemas.DashboardStats)
def dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == models.RoleEnum.admin:
        base_q = db.query(models.Task)
    else:
        project_ids = [p.id for p in current_user.projects] + [p.id for p in current_user.owned_projects]
        base_q = db.query(models.Task).filter(
            or_(
                models.Task.project_id.in_(project_ids),
                models.Task.assignee_id == current_user.id,
            )
        )

    all_tasks = base_q.all()
    now = datetime.utcnow()

    todo = sum(1 for t in all_tasks if t.status == models.TaskStatus.todo)
    in_progress = sum(1 for t in all_tasks if t.status == models.TaskStatus.in_progress)
    done = sum(1 for t in all_tasks if t.status == models.TaskStatus.done)
    overdue = sum(
        1 for t in all_tasks
        if t.due_date and t.due_date < now and t.status != models.TaskStatus.done
    )

    my_tasks = [t for t in all_tasks if t.assignee_id == current_user.id]

    return {
        "total_tasks": len(all_tasks),
        "todo": todo,
        "in_progress": in_progress,
        "done": done,
        "overdue": overdue,
        "my_tasks": my_tasks,
    }
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from app.models import RoleEnum, TaskStatus, TaskPriority


class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role: Optional[RoleEnum] = RoleEnum.member


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(UserBase):
    id: int
    role: RoleEnum
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectOut(ProjectBase):
    id: int
    owner_id: int
    created_at: datetime
    members: List[UserOut] = []

    class Config:
        from_attributes = True


class AddMember(BaseModel):
    user_id: int


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[TaskStatus] = TaskStatus.todo
    priority: Optional[TaskPriority] = TaskPriority.medium
    due_date: Optional[datetime] = None
    assignee_id: Optional[int] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None
    assignee_id: Optional[int] = None


class TaskOut(TaskBase):
    id: int
    project_id: int
    created_by: int
    created_at: datetime
    updated_at: datetime
    assignee: Optional[UserOut] = None

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_tasks: int
    todo: int
    in_progress: int
    done: int
    overdue: int
    my_tasks: List[TaskOut]
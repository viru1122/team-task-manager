from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Text, Table
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class RoleEnum(str, enum.Enum):
    admin = "admin"
    member = "member"


class TaskStatus(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


project_members = Table(
    "project_members",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.member, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owned_projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    projects = relationship("Project", secondary=project_members, back_populates="members")
    assigned_tasks = relationship("Task", back_populates="assignee", foreign_keys="Task.assignee_id")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="owned_projects")
    members = relationship("User", secondary=project_members, back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(Enum(TaskStatus), default=TaskStatus.todo, nullable=False)
    priority = Column(Enum(TaskPriority), default=TaskPriority.medium, nullable=False)
    due_date = Column(DateTime)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="assigned_tasks", foreign_keys=[assignee_id])
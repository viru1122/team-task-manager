import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import Base, engine
from app.routers import users, projects, tasks

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Team Task Manager API",
    description="A full-stack project & task management system with role-based access control",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(users.users_router)
app.include_router(projects.router)
app.include_router(tasks.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


if os.path.isdir("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

    @app.get("/")
    def root():
        return FileResponse("static/index.html")

    @app.get("/dashboard")
    def dashboard_page():
        return FileResponse("static/dashboard.html")
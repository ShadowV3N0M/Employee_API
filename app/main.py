"""Employee Management API - Application factory and main ASGI app."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import CORS_ORIGINS, limiter
from app.database import Base, auto_migrate_schema, engine
import app.models  # noqa: F401
from app.routers import (
    auth_router,
    department_router,
    employee_router,
    health_router,
    salary_router,
    holiday_router,
    notification_router,
    profile_router,
    reports_router,
    analytics_router,
)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Employee HRMS API",
        description="A secure API application for managing employees and departments.",
        version="2.1.2",   # Update the version number as needed
    )

    # Attach rate limiter
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register Routers
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(department_router)
    app.include_router(employee_router)
    app.include_router(salary_router)
    app.include_router(holiday_router)
    app.include_router(notification_router)
    app.include_router(profile_router)
    app.include_router(reports_router)
    app.include_router(analytics_router)

    from fastapi.responses import RedirectResponse

    @app.get("/", include_in_schema=False)
    def root():
        """Redirect root URL to interactive documentation."""
        return RedirectResponse(url="/docs")

    # Startup event: create tables & auto-migrate schema

    @app.on_event("startup")
    def on_startup():
        Base.metadata.create_all(bind=engine)
        auto_migrate_schema()

    return app


app = create_app()

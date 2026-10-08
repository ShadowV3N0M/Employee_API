"""FastAPI application routers."""
from app.routers.auth import router as auth_router
from app.routers.departments import router as department_router
from app.routers.employees import router as employee_router
from app.routers.health import router as health_router
from app.routers.salaries import router as salary_router
from app.routers.holidays import router as holiday_router
from app.routers.notifications import router as notification_router
from app.routers.profile import router as profile_router
from app.routers.reports import router as reports_router
from app.routers.analytics import router as analytics_router

__all__ = [
    "auth_router",
    "department_router",
    "employee_router",
    "health_router",
    "salary_router",
    "holiday_router",
    "notification_router",
    "profile_router",
    "reports_router",
    "analytics_router",
]

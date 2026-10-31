"""Employee Management API - Application factory and main ASGI app."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import (
    CORS_ORIGINS,
    ENFORCE_HTTPS,
    HSTS_INCLUDE_SUBDOMAINS,
    HSTS_MAX_AGE,
    HSTS_PRELOAD,
    limiter,
)
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
    attendance_router,
    sync_router,
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

    # HTTPS Enforcement & Security Headers Middleware
    @app.middleware("http")
    async def enforce_https_and_security_headers(request: Request, call_next):
        # 1. Enforce HTTPS redirection if configured
        proto = request.headers.get("x-forwarded-proto", request.url.scheme).lower()
        host = request.url.hostname or ""

        # Redirect non-HTTPS requests when ENFORCE_HTTPS is active
        # (do not redirect testclient or local loopback unless explicitly forwarded as http from a proxy)
        if ENFORCE_HTTPS and proto == "http":
            if host not in ("testserver", "localhost", "127.0.0.1") or request.headers.get("x-forwarded-proto") == "http":
                secure_url = request.url.replace(scheme="https")
                return RedirectResponse(url=str(secure_url), status_code=301)

        response = await call_next(request)

        # 2. Strict-Transport-Security (HSTS)
        if ENFORCE_HTTPS or proto == "https":
            hsts_parts = [f"max-age={HSTS_MAX_AGE}"]
            if HSTS_INCLUDE_SUBDOMAINS:
                hsts_parts.append("includeSubDomains")
            if HSTS_PRELOAD:
                hsts_parts.append("preload")
            response.headers["Strict-Transport-Security"] = "; ".join(hsts_parts)

        # 3. Secure Cookie Enforcements on HTTPS
        if (ENFORCE_HTTPS or proto == "https") and "set-cookie" in response.headers:
            new_raw = []
            for name, val in response.raw_headers:
                if name.lower() == b"set-cookie":
                    val_str = val.decode("latin-1", errors="ignore")
                    if "secure" not in val_str.lower():
                        val = f"{val_str}; Secure".encode("latin-1")
                new_raw.append((name, val))
            response.raw_headers = new_raw

        # 4. Essential Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        return response

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
    app.include_router(attendance_router)
    app.include_router(sync_router)

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

"""Application configuration and environment variables."""
import os
from slowapi import Limiter
from slowapi.util import get_remote_address

# Security & JWT
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Database
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:Root%401234@localhost:3306/userdb"
)

# SMTP & Password Reset
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "smtp.gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "no-reply@laesfera.co")
SMTP_TLS = os.getenv("SMTP_TLS", "true").lower() in ("true", "1", "yes")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "15"))

# Email generation having any default companies domain name, if not provided, it will default to "laesfera.co"
EMAIL_DOMAIN = os.getenv("EMAIL_DOMAIN", "laesfera.co")

# CORS Configuration
_raw_cors = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://192.168.0.175:5173"
)
CORS_ORIGINS = [origin.strip()
                for origin in _raw_cors.split(",") if origin.strip()]

# Rate Limiter for this application
RATE_LIMIT_SENSITIVE = os.getenv("RATE_LIMIT_SENSITIVE", "120/minute")
RATE_LIMIT_STANDARD = os.getenv("RATE_LIMIT_STANDARD", "300/minute")
limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT_STANDARD])

# HTTPS Enforcement & HSTS Security Headers
ENFORCE_HTTPS = os.getenv("ENFORCE_HTTPS", "false").lower() in ("true", "1", "yes")
HSTS_MAX_AGE = int(os.getenv("HSTS_MAX_AGE", "31536000"))  # 1 year in seconds
HSTS_INCLUDE_SUBDOMAINS = os.getenv("HSTS_INCLUDE_SUBDOMAINS", "true").lower() in ("true", "1", "yes")
HSTS_PRELOAD = os.getenv("HSTS_PRELOAD", "true").lower() in ("true", "1", "yes")

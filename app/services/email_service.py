"""Email generation and SMTP dispatch services."""
import smtplib
from datetime import datetime, date, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Union
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.config import (
    EMAIL_DOMAIN,
    FRONTEND_URL,
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    SMTP_FROM_EMAIL,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_TLS,
    SMTP_USER,
)
from app.models.employee import EmployeeDB


def generate_employee_email(
    db: Session,
    f_name: str,
    l_name: str,
    joining_date: Optional[Union[datetime, date, str]] = None,
    date_format: str = "%Y"
) -> str:
    """
    Builds sagar.p@laesfera.co style emails from first name + last initial.

    If that collides with an existing employee with a different last name,
    it extends the last-name portion one letter at a time (e.g. Parth Patil
    vs Parth Pandey becomes parth.pat vs parth.pan).

    If an employee with the EXACT same first and last name already exists,
    or if all letter prefixes are exhausted, a suffix based on the employee's
    joining date (e.g. parth.patil2026@laesfera.co) is applied.
    """
    first = f_name.strip().lower().replace(" ", "")
    last = l_name.strip().lower().replace(" ", "")

    def email_taken(candidate: str) -> bool:
        return db.query(EmployeeDB).filter(EmployeeDB.Email == candidate).first() is not None

    # Parse joining date for suffix
    if joining_date is None:
        j_date = datetime.now(timezone.utc)
    elif isinstance(joining_date, datetime):
        j_date = joining_date
    elif isinstance(joining_date, date):
        j_date = datetime.combine(
            joining_date, datetime.min.time(), tzinfo=timezone.utc)
    elif isinstance(joining_date, str):
        try:
            j_date = datetime.fromisoformat(
                joining_date.replace("Z", "+00:00"))
        except ValueError:
            try:
                j_date = datetime.strptime(joining_date, "%Y-%m-%d")
            except ValueError:
                j_date = datetime.now(timezone.utc)
    else:
        j_date = datetime.now(timezone.utc)

    date_suffix = j_date.strftime(date_format)

    # 1. Single name (no last name provided)
    if not last:
        candidate = f"{first}@{EMAIL_DOMAIN}"
        if not email_taken(candidate):
            return candidate
        candidate = f"{first}{date_suffix}@{EMAIL_DOMAIN}"
        suffix = 2
        while email_taken(candidate):
            candidate = f"{first}{date_suffix}.{suffix}@{EMAIL_DOMAIN}"
            suffix += 1
        return candidate

    # 2. Check if an employee with the exact same first and last name already exists AND joining_date was provided
    same_fullname_exists = db.query(EmployeeDB).filter(
        func.lower(EmployeeDB.F_Name) == f_name.strip().lower(),
        func.lower(EmployeeDB.L_Name) == l_name.strip().lower()
    ).first() is not None

    if same_fullname_exists and joining_date is not None:
        candidate = f"{first}.{last}{date_suffix}@{EMAIL_DOMAIN}"
        suffix = 2
        while email_taken(candidate):
            candidate = f"{first}.{last}{date_suffix}.{suffix}@{EMAIL_DOMAIN}"
            suffix += 1
        return candidate

    # 3. Try growing prefixes of the last name: p, pa, pat...
    for i in range(1, len(last) + 1):
        candidate = f"{first}.{last[:i]}@{EMAIL_DOMAIN}"
        if not email_taken(candidate):
            return candidate

    # 4. Fallback if all prefixes were taken:
    if joining_date is not None:
        candidate = f"{first}.{last}{date_suffix}@{EMAIL_DOMAIN}"
        suffix = 2
        while email_taken(candidate):
            candidate = f"{first}.{last}{date_suffix}.{suffix}@{EMAIL_DOMAIN}"
            suffix += 1
        return candidate
    else:
        suffix = 2
        candidate = f"{first}.{last}{suffix}@{EMAIL_DOMAIN}"
        while email_taken(candidate):
            suffix += 1
            candidate = f"{first}.{last}{suffix}@{EMAIL_DOMAIN}"
        return candidate



def send_password_reset_email(to_email: str, username: str, reset_token: str) -> bool:
    """
    Sends a password reset email if SMTP is configured.
    If SMTP is not configured (e.g. local dev / testing), prints the reset link to console.
    """
    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"

    if not SMTP_HOST or not SMTP_USER:
        print("\n" + "=" * 60)
        print(f"[AUTH DEV] Password Reset Link for '{username}' ({to_email}):")
        print(f"URL: {reset_url}")
        print(f"Token: {reset_token}")
        print("=" * 60 + "\n")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Password Reset Request - Employee Management"
        msg["From"] = SMTP_FROM_EMAIL
        msg["To"] = to_email

        text_content = f"""Hello {username},

We received a request to reset your password.
Click the link below to set a new password (valid for {PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes):

{reset_url}

If you did not request this, you can safely ignore this email.
"""

        html_content = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2>Password Reset Request</h2>
    <p>Hello <strong>{username}</strong>,</p>
    <p>We received a request to reset your password. Click the button below to choose a new password:</p>
    <p style="margin: 25px 0;">
        <a href="{reset_url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
    </p>
    <p style="font-size: 13px; color: #666;">This link is valid for {PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes.</p>
    <p style="font-size: 13px; color: #888;">Or copy and paste this URL into your browser:<br><code>{reset_url}</code></p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="font-size: 12px; color: #999;">If you didn't request this reset, you can safely ignore this email.</p>
</body>
</html>"""

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            if SMTP_TLS:
                server.starttls()
            if SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f"[ERROR] Failed to send email via SMTP: {e}")
        return False

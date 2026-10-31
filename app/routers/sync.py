"""PWA Synchronization and Delta Replication Router."""
from datetime import datetime, timezone, date
import hashlib
from typing import Optional
from fastapi import APIRouter, Depends, Header, Request, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.employee import EmployeeDB
from app.models.department import DepartmentDB
from app.models.holiday import HolidayDB, AnnouncementDB
from app.models.attendance import AttendanceDB
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/sync", tags=["PWA & Delta Synchronization"])


def _calculate_etag(emp_count: int, emp_latest: Optional[datetime],
                    dept_count: int,
                    holiday_count: int,
                    att_count: int) -> str:
    """Generate deterministic MD5 fingerprint representing current data snapshot."""
    raw = (
        f"emp:{emp_count}:{emp_latest.isoformat() if emp_latest else '0'};"
        f"dept:{dept_count};"
        f"hol:{holiday_count};"
        f"att:{att_count}"
    )
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


@router.get("/status")
def sync_status():
    """
    Lightweight health and sync connectivity probe for PWA clients.
    Allows clients to determine online/offline synchronization readiness.
    """
    return {
        "status": "online",
        "pwa_ready": True,
        "server_time": datetime.now(timezone.utc).isoformat(),
        "api_version": "2.6",
    }


@router.get("/delta")
def get_delta_sync(
    request: Request,
    response: Response,
    since: Optional[str] = None,
    if_none_match: Optional[str] = Header(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns delta modifications since the provided timestamp with ETag 304 validation.
    Enables low-bandwidth offline caching and instant reconnect reconciliation for mobile PWAs.
    """
    today = date.today()

    parsed_since = None
    if since:
        try:
            # Handle query string space decoded from +
            cleaned = since.replace(" ", "+").replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned)
            if dt.tzinfo is not None:
                parsed_since = dt.astimezone(timezone.utc).replace(tzinfo=None)
            else:
                parsed_since = dt
        except Exception:
            parsed_since = None

    # Query counts & snapshot metrics
    emp_count = db.query(func.count(EmployeeDB.Emp_ID)).filter(EmployeeDB.is_active.is_(True)).scalar() or 0
    emp_latest = db.query(func.max(EmployeeDB.updated_at)).scalar()
    dept_count = db.query(func.count(DepartmentDB.Dept_ID)).scalar() or 0
    holiday_count = db.query(func.count(HolidayDB.id)).scalar() or 0
    att_today_count = db.query(func.count(AttendanceDB.id)).filter(AttendanceDB.attendance_date == today).scalar() or 0

    # Compute ETag
    etag = _calculate_etag(emp_count, emp_latest, dept_count, holiday_count, att_today_count)
    etag_quoted = f'"{etag}"'

    # Check for client cache validation
    if if_none_match and (if_none_match == etag or if_none_match == etag_quoted):
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)

    response.headers["ETag"] = etag_quoted
    response.headers["Cache-Control"] = "no-cache"

    # Query delta records if 'since' timestamp is passed
    emp_query = db.query(EmployeeDB)
    if parsed_since:
        emp_query = emp_query.filter(EmployeeDB.updated_at >= parsed_since)
    else:
        # Default snapshot for initial sync (active employees)
        emp_query = emp_query.filter(EmployeeDB.is_active.is_(True))
    employees = emp_query.limit(200).all()

    # Departments snapshot
    departments = db.query(DepartmentDB).all()

    # Holidays (current year)
    holidays = (
        db.query(HolidayDB)
        .filter(HolidayDB.holiday_date >= today)
        .order_by(HolidayDB.holiday_date.asc())
        .limit(20)
        .all()
    )

    # Announcements
    announcements = (
        db.query(AnnouncementDB)
        .order_by(AnnouncementDB.is_pinned.desc(), AnnouncementDB.created_at.desc())
        .limit(10)
        .all()
    )

    # Current user's attendance today
    my_attendance = None
    if getattr(current_user, "emp_id", None):
        my_attendance = (
            db.query(AttendanceDB)
            .filter(
                AttendanceDB.emp_id == current_user.emp_id,
                AttendanceDB.attendance_date == today,
            )
            .first()
        )

    return {
        "server_time": datetime.now(timezone.utc).isoformat(),
        "etag": etag,
        "since": parsed_since.isoformat() if parsed_since else since,
        "counts": {
            "total_employees": emp_count,
            "total_departments": dept_count,
            "upcoming_holidays": len(holidays),
            "attendance_today": att_today_count,
        },
        "delta": {
            "employees": [
                {
                    "Emp_ID": e.Emp_ID,
                    "F_Name": e.F_Name,
                    "L_Name": e.L_Name,
                    "Salary": float(e.Salary) if e.Salary is not None else 0.0,
                    "Dept_ID": e.Dept_ID,
                    "Email": e.Email,
                    "is_active": e.is_active,
                    "updated_at": e.updated_at.isoformat() if e.updated_at else None,
                }
                for e in employees
            ],
            "departments": [
                {
                    "Dept_ID": d.Dept_ID,
                    "Dept_Name": d.Dept_Name,
                    "Budget": float(d.Budget) if d.Budget is not None else None,
                }
                for d in departments
            ],
            "holidays": [
                {
                    "id": h.id,
                    "name": h.name,
                    "holiday_date": h.holiday_date.isoformat(),
                    "holiday_type": h.holiday_type,
                }
                for h in holidays
            ],
            "announcements": [
                {
                    "id": a.id,
                    "title": a.title,
                    "priority": a.priority,
                    "is_pinned": a.is_pinned,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in announcements
            ],
            "my_attendance_today": {
                "id": my_attendance.id,
                "status": my_attendance.status,
                "work_mode": my_attendance.work_mode,
                "clock_in": my_attendance.clock_in.isoformat() if my_attendance and my_attendance.clock_in else None,
                "clock_out": my_attendance.clock_out.isoformat() if my_attendance and my_attendance.clock_out else None,
            } if my_attendance else None,
        },
    }

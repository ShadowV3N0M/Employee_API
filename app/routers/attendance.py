"""FastAPI Router for Employee Attendance, Live Punches, Breaks, Timesheets, and Regularization."""
from datetime import date, datetime, timedelta
import logging
from typing import List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_admin, require_manager_or_admin
from app.config import limiter
from app.database import get_db
from app.models.attendance import AttendanceBreakDB, AttendanceDB, AttendanceRegularizationDB
from app.models.department import DepartmentDB
from app.models.employee import EmployeeDB
from app.models.user import UserDB
from app.routers.profile import resolve_user_employee
from app.schemas.attendance import (
    AttendanceBreakOut,
    AttendanceManualEntry,
    AttendanceMonthlyReport,
    AttendanceOut,
    AttendanceRegularizeCreate,
    AttendanceRegularizeOut,
    AttendanceRegularizeReview,
    AttendanceSummaryKPIs,
    AttendanceTodayStatus,
    BreakEndRequest,
    BreakStartRequest,
    ClockInRequest,
    ClockOutRequest,
    TeamLiveRoster,
)
from app.services.attendance_service import (
    _calculate_work_metrics,
    _check_is_late,
    _to_attendance_out,
    calculate_monthly_kpis,
    clock_in_employee,
    clock_out_employee,
    create_regularization_request,
    end_break,
    generate_attendance_csv,
    generate_attendance_pdf,
    get_employee_attendance_history,
    get_team_live_roster,
    get_today_status,
    review_regularization_request,
    start_break,
)

logger = logging.getLogger("attendance")

router = APIRouter(prefix="/attendance", tags=["Employee Attendance & Time-Tracking"])


def _get_linked_employee(db: Session, current_user: UserDB) -> EmployeeDB:
    """Helper to resolve current user's linked Employee record or raise 400."""
    emp = resolve_user_employee(db, current_user)
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your user account is not linked to an official employee profile in the directory. Please contact your HR administrator.",
        )
    return emp


# =========================================================================
# Self-Service Punch Terminal (Clock In, Clock Out, Breaks)
# =========================================================================

@router.post("/clock-in", response_model=AttendanceOut)
@limiter.limit("120/minute")
def punch_clock_in(
    request: Request,
    payload: ClockInRequest = Body(default_factory=ClockInRequest),
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record employee clock-in punch."""
    emp = _get_linked_employee(db, current_user)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")[:250]

    return clock_in_employee(
        db=db,
        emp_id=emp.Emp_ID,
        work_mode=payload.work_mode or "office",
        notes=payload.notes,
        ip_address=client_ip,
        device_info=user_agent,
    )


@router.post("/clock-out", response_model=AttendanceOut)
@limiter.limit("120/minute")
def punch_clock_out(
    request: Request,
    payload: ClockOutRequest = Body(default_factory=ClockOutRequest),
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record employee clock-out punch and finalize daily working hours."""
    emp = _get_linked_employee(db, current_user)
    return clock_out_employee(
        db=db,
        emp_id=emp.Emp_ID,
        notes=payload.notes,
    )


@router.post("/break/start", response_model=AttendanceBreakOut)
@limiter.limit("120/minute")
def punch_break_start(
    request: Request,
    payload: BreakStartRequest = Body(default_factory=BreakStartRequest),
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start an active break (e.g. Lunch, Tea, Personal)."""
    emp = _get_linked_employee(db, current_user)
    return start_break(
        db=db,
        emp_id=emp.Emp_ID,
        break_type=payload.break_type or "lunch",
        notes=payload.notes,
    )


@router.post("/break/end", response_model=AttendanceBreakOut)
@limiter.limit("120/minute")
def punch_break_end(
    request: Request,
    payload: BreakEndRequest = Body(default_factory=BreakEndRequest),
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """End the ongoing break and resume work."""
    emp = _get_linked_employee(db, current_user)
    return end_break(
        db=db,
        emp_id=emp.Emp_ID,
        notes=payload.notes,
    )


@router.get("/today", response_model=AttendanceTodayStatus)
def get_my_today_status(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get live attendance status, timer, and current state for logged-in user."""
    emp = resolve_user_employee(db, current_user)
    if not emp:
        return AttendanceTodayStatus(
            is_clocked_in=False,
            is_clocked_out=False,
            is_on_break=False,
        )
    return get_today_status(db, emp)


# =========================================================================
# Self-Service History & Monthly Analytics
# =========================================================================

@router.get("/my-history", response_model=List[AttendanceOut])
def get_my_history(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    status: Optional[str] = None,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get logged-in user's attendance records with optional date filters."""
    emp = _get_linked_employee(db, current_user)
    return get_employee_attendance_history(
        db=db,
        emp_id=emp.Emp_ID,
        from_date=from_date,
        to_date=to_date,
        status_filter=status,
    )


@router.get("/my-summary", response_model=AttendanceSummaryKPIs)
def get_my_monthly_summary(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get monthly attendance KPIs, punctuality rate, and overtime metrics."""
    emp = _get_linked_employee(db, current_user)
    now = date.today()
    target_month = month or now.month
    target_year = year or now.year

    if target_month < 1 or target_month > 12:
        raise HTTPException(status_code=400, detail="Invalid month (1-12).")

    return calculate_monthly_kpis(
        db=db,
        emp_id=emp.Emp_ID,
        year=target_year,
        month=target_month,
    )


# =========================================================================
# Attendance Regularization Requests
# =========================================================================

@router.post("/regularize", response_model=AttendanceRegularizeOut)
def submit_regularization(
    payload: AttendanceRegularizeCreate,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a missed punch / attendance correction request."""
    emp = _get_linked_employee(db, current_user)
    return create_regularization_request(db=db, emp_id=emp.Emp_ID, req=payload)


@router.get("/regularize/my-requests", response_model=List[AttendanceRegularizeOut])
def get_my_regularization_requests(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all regularization requests submitted by logged-in user."""
    emp = _get_linked_employee(db, current_user)
    reqs = (
        db.query(AttendanceRegularizationDB)
        .filter(AttendanceRegularizationDB.emp_id == emp.Emp_ID)
        .order_by(AttendanceRegularizationDB.created_at.desc())
        .all()
    )
    emp_name = f"{emp.F_Name} {emp.L_Name}".strip()
    return [
        AttendanceRegularizeOut(
            id=r.id,
            emp_id=r.emp_id,
            employee_name=emp_name,
            attendance_date=r.attendance_date,
            requested_clock_in=r.requested_clock_in,
            requested_clock_out=r.requested_clock_out,
            reason=r.reason,
            status=r.status,
            reviewed_by=r.reviewed_by,
            reviewed_at=r.reviewed_at,
            review_notes=r.review_notes,
            created_at=r.created_at,
        )
        for r in reqs
    ]


# =========================================================================
# Manager & Admin Endpoints (Team Live Roster & Administration)
# =========================================================================

@router.get("/team-live", response_model=TeamLiveRoster)
def get_team_live(
    dept_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: UserDB = Depends(require_manager_or_admin),
    db: Session = Depends(get_db),
):
    """Get live attendance presence roster for the team/organization today."""
    return get_team_live_roster(
        db=db,
        dept_id=dept_id,
        status_filter=status,
    )


@router.get("/roster")
def get_attendance_roster(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    dept_id: Optional[int] = None,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    search: Optional[str] = None,
    current_user: UserDB = Depends(require_manager_or_admin),
    db: Session = Depends(get_db),
):
    """Filterable, paginated company-wide attendance roster."""
    query = db.query(AttendanceDB).join(EmployeeDB, AttendanceDB.emp_id == EmployeeDB.Emp_ID)

    if dept_id:
        query = query.filter(EmployeeDB.Dept_ID == dept_id)
    if status and status.lower() != "all":
        query = query.filter(func.lower(AttendanceDB.status) == status.lower())
    if from_date:
        query = query.filter(AttendanceDB.attendance_date >= from_date)
    if to_date:
        query = query.filter(AttendanceDB.attendance_date <= to_date)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(EmployeeDB.F_Name).like(term),
                func.lower(EmployeeDB.L_Name).like(term),
                func.lower(func.concat(EmployeeDB.F_Name, " ", EmployeeDB.L_Name)).like(term),
                func.cast(EmployeeDB.Emp_ID, func.CHAR).like(term),
            )
        )

    total = query.count()
    records = (
        query.order_by(AttendanceDB.attendance_date.desc(), AttendanceDB.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "items": [_to_attendance_out(r) for r in records],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/regularize/pending", response_model=List[AttendanceRegularizeOut])
def get_pending_regularizations(
    current_user: UserDB = Depends(require_manager_or_admin),
    db: Session = Depends(get_db),
):
    """List all pending regularization requests across employees."""
    reqs = (
        db.query(AttendanceRegularizationDB)
        .filter(AttendanceRegularizationDB.status == "pending")
        .order_by(AttendanceRegularizationDB.created_at.asc())
        .all()
    )
    res = []
    for r in reqs:
        emp = r.employee
        emp_name = f"{emp.F_Name} {emp.L_Name}".strip() if emp else f"Emp #{r.emp_id}"
        res.append(
            AttendanceRegularizeOut(
                id=r.id,
                emp_id=r.emp_id,
                employee_name=emp_name,
                attendance_date=r.attendance_date,
                requested_clock_in=r.requested_clock_in,
                requested_clock_out=r.requested_clock_out,
                reason=r.reason,
                status=r.status,
                reviewed_by=r.reviewed_by,
                reviewed_at=r.reviewed_at,
                review_notes=r.review_notes,
                created_at=r.created_at,
            )
        )
    return res


@router.post("/regularize/{req_id}/review", response_model=AttendanceRegularizeOut)
def review_regularization(
    req_id: int,
    payload: AttendanceRegularizeReview,
    current_user: UserDB = Depends(require_manager_or_admin),
    db: Session = Depends(get_db),
):
    """Approve or reject a pending regularization request."""
    return review_regularization_request(
        db=db,
        req_id=req_id,
        review=payload,
        reviewer_username=current_user.username,
    )


@router.post("/manual", response_model=AttendanceOut)
def create_manual_attendance(
    payload: AttendanceManualEntry,
    current_user: UserDB = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin manual override or adjustment of an attendance record."""
    emp = db.query(EmployeeDB).filter(EmployeeDB.Emp_ID == payload.emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")

    existing = (
        db.query(AttendanceDB)
        .filter(
            AttendanceDB.emp_id == payload.emp_id,
            AttendanceDB.attendance_date == payload.attendance_date,
        )
        .first()
    )

    is_late = False
    late_mins = 0
    if payload.clock_in:
        is_late, late_mins = _check_is_late(payload.clock_in)

    total_hours, reg_hours, ot_hours, is_half_day = _calculate_work_metrics(
        payload.clock_in, payload.clock_out, 0
    )

    if existing:
        existing.clock_in = payload.clock_in
        existing.clock_out = payload.clock_out
        existing.status = payload.status
        existing.work_mode = payload.work_mode
        existing.total_hours = total_hours
        existing.regular_hours = reg_hours
        existing.overtime_hours = ot_hours
        existing.is_late = is_late
        existing.late_minutes = late_mins
        existing.is_half_day = is_half_day
        if payload.notes:
            existing.notes = payload.notes
        db.commit()
        db.refresh(existing)
        return _to_attendance_out(existing)

    new_rec = AttendanceDB(
        emp_id=payload.emp_id,
        attendance_date=payload.attendance_date,
        clock_in=payload.clock_in,
        clock_out=payload.clock_out,
        status=payload.status,
        work_mode=payload.work_mode,
        total_hours=total_hours,
        regular_hours=reg_hours,
        overtime_hours=ot_hours,
        is_late=is_late,
        late_minutes=late_mins,
        is_half_day=is_half_day,
        notes=payload.notes,
    )
    db.add(new_rec)
    db.commit()
    db.refresh(new_rec)
    return _to_attendance_out(new_rec)


@router.delete("/{attendance_id}")
def delete_attendance_record(
    attendance_id: int,
    current_user: UserDB = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin deletion of an attendance record."""
    rec = db.query(AttendanceDB).filter(AttendanceDB.id == attendance_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    db.delete(rec)
    db.commit()
    return {"message": f"Attendance record #{attendance_id} deleted successfully."}


# =========================================================================
# Export Endpoints (CSV & PDF)
# =========================================================================

@router.get("/export/csv")
def export_attendance_csv(
    emp_id: Optional[int] = None,
    dept_id: Optional[int] = None,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export attendance records to CSV."""
    # Enforce role scoping: Regular users can only export their own records
    target_emp_id = emp_id
    if current_user.role not in ("admin", "manager"):
        emp = _get_linked_employee(db, current_user)
        target_emp_id = emp.Emp_ID

    query = db.query(AttendanceDB)
    if target_emp_id:
        query = query.filter(AttendanceDB.emp_id == target_emp_id)
    if dept_id and current_user.role in ("admin", "manager"):
        query = query.join(EmployeeDB).filter(EmployeeDB.Dept_ID == dept_id)
    if status and status.lower() != "all":
        query = query.filter(func.lower(AttendanceDB.status) == status.lower())
    if from_date:
        query = query.filter(AttendanceDB.attendance_date >= from_date)
    if to_date:
        query = query.filter(AttendanceDB.attendance_date <= to_date)

    records = query.order_by(AttendanceDB.attendance_date.desc()).all()
    records_out = [_to_attendance_out(r) for r in records]

    csv_data = generate_attendance_csv(records_out)
    filename = f"attendance_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/pdf")
def export_attendance_pdf(
    emp_id: Optional[int] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    inline: bool = True,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate and export formal Attendance & Timesheet PDF report."""
    target_emp_id = emp_id
    if current_user.role not in ("admin", "manager"):
        emp = _get_linked_employee(db, current_user)
        target_emp_id = emp.Emp_ID

    now = date.today()
    target_month = month or now.month
    target_year = year or now.year

    first_day = date(target_year, target_month, 1)
    if target_month == 12:
        last_day = date(target_year, 12, 31)
    else:
        last_day = date(target_year, target_month + 1, 1) - timedelta(days=1)

    query = db.query(AttendanceDB).filter(
        AttendanceDB.attendance_date >= first_day,
        AttendanceDB.attendance_date <= last_day,
    )
    if target_emp_id:
        query = query.filter(AttendanceDB.emp_id == target_emp_id)

    records = query.order_by(AttendanceDB.attendance_date.desc()).all()
    records_out = [_to_attendance_out(r) for r in records]

    kpis = None
    title = f"Attendance & Timesheet Report — {first_day.strftime('%B %Y')}"
    subtitle = "Official Company Workforce Timesheet Statement"

    if target_emp_id:
        kpis = calculate_monthly_kpis(db, target_emp_id, target_year, target_month)
        emp = db.query(EmployeeDB).filter(EmployeeDB.Emp_ID == target_emp_id).first()
        if emp:
            title = f"Timesheet Statement: {emp.F_Name} {emp.L_Name} (#{emp.Emp_ID})"
            dept_name = emp.department.Dept_Name if emp.department else f"Dept #{emp.Dept_ID}"
            subtitle = f"Department: {dept_name} · Period: {first_day.strftime('%B %Y')}"

    pdf_bytes = generate_attendance_pdf(
        records=records_out,
        kpis=kpis,
        title=title,
        subtitle=subtitle,
    )

    disposition = "inline" if inline else "attachment"
    filename = f"attendance_report_{target_year}_{target_month:02d}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )

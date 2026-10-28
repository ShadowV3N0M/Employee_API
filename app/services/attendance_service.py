"""Attendance & Time-Tracking Business Logic, Policy Engine, and Report Exporters."""
import csv
from datetime import date, datetime, time, timedelta
import io
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.attendance import AttendanceBreakDB, AttendanceDB, AttendanceRegularizationDB
from app.models.department import DepartmentDB
from app.models.employee import EmployeeDB
from app.models.holiday import HolidayDB
from app.schemas.attendance import (
    AttendanceBreakOut,
    AttendanceMonthlyReport,
    AttendanceOut,
    AttendanceRegularizeCreate,
    AttendanceRegularizeOut,
    AttendanceRegularizeReview,
    AttendanceSummaryKPIs,
    AttendanceTodayStatus,
    TeamLiveMember,
    TeamLiveRoster,
)
from app.services.notification_service import dispatch_notification

# =========================================================================
# Attendance Policy Constants
# =========================================================================
STANDARD_SHIFT_START_HOUR = 9
STANDARD_SHIFT_START_MINUTE = 30  # 09:30 AM
GRACE_PERIOD_MINUTES = 15          # Up to 09:45 AM is On-Time; after 09:45 is Late
STANDARD_SHIFT_END_HOUR = 18
STANDARD_SHIFT_END_MINUTE = 0      # 06:00 PM
STANDARD_DAILY_HOURS = 8.0         # 8.0 hours standard working shift
HALF_DAY_HOURS = 4.0               # Under 4.0 hours constitutes a Half Day


def _check_is_late(clock_in: datetime) -> Tuple[bool, int]:
    """Calculate if clock-in is past shift start + grace period, and minutes late."""
    shift_start_today = datetime.combine(
        clock_in.date(),
        time(STANDARD_SHIFT_START_HOUR, STANDARD_SHIFT_START_MINUTE)
    )
    grace_cutoff = shift_start_today + timedelta(minutes=GRACE_PERIOD_MINUTES)
    if clock_in > grace_cutoff:
        diff_sec = (clock_in - shift_start_today).total_seconds()
        late_mins = max(1, int(diff_sec / 60))
        return True, late_mins
    return False, 0


def _calculate_work_metrics(
    clock_in: Optional[datetime],
    clock_out: Optional[datetime],
    total_break_minutes: int
) -> Tuple[float, float, float, bool]:
    """Calculate total net working hours, regular hours, overtime, and half-day flag."""
    if not clock_in or not clock_out or clock_out <= clock_in:
        return 0.0, 0.0, 0.0, False

    gross_seconds = (clock_out - clock_in).total_seconds()
    net_seconds = max(0.0, gross_seconds - (total_break_minutes * 60))
    total_hours = round(net_seconds / 3600.0, 2)
    regular_hours = min(total_hours, STANDARD_DAILY_HOURS)
    overtime_hours = max(0.0, round(total_hours - STANDARD_DAILY_HOURS, 2))
    is_half_day = total_hours < HALF_DAY_HOURS
    return total_hours, regular_hours, overtime_hours, is_half_day


def _to_attendance_out(record: AttendanceDB) -> AttendanceOut:
    """Format SQLAlchemy AttendanceDB model to Pydantic AttendanceOut."""
    emp = record.employee
    emp_name = f"{emp.F_Name} {emp.L_Name}".strip() if emp else f"Emp #{record.emp_id}"
    dept_name = emp.department.Dept_Name if emp and emp.department else (f"Dept #{emp.Dept_ID}" if emp else None)
    dept_id = emp.Dept_ID if emp else None

    breaks_out = [
        AttendanceBreakOut(
            id=b.id,
            attendance_id=b.attendance_id,
            break_type=b.break_type,
            start_time=b.start_time,
            end_time=b.end_time,
            duration_minutes=b.duration_minutes,
            notes=b.notes,
        )
        for b in record.breaks
    ]

    return AttendanceOut(
        id=record.id,
        emp_id=record.emp_id,
        employee_name=emp_name,
        department_id=dept_id,
        department_name=dept_name,
        attendance_date=record.attendance_date,
        clock_in=record.clock_in,
        clock_out=record.clock_out,
        status=record.status,
        work_mode=record.work_mode,
        total_hours=float(record.total_hours or 0.0),
        regular_hours=float(record.regular_hours or 0.0),
        overtime_hours=float(record.overtime_hours or 0.0),
        is_late=record.is_late,
        late_minutes=record.late_minutes,
        is_half_day=record.is_half_day,
        notes=record.notes,
        ip_address=record.ip_address,
        device_info=record.device_info,
        breaks=breaks_out,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


# =========================================================================
# Attendance Punch Actions (Clock In, Clock Out, Breaks)
# =========================================================================

def clock_in_employee(
    db: Session,
    emp_id: int,
    work_mode: str = "office",
    notes: Optional[str] = None,
    ip_address: Optional[str] = None,
    device_info: Optional[str] = None,
) -> AttendanceOut:
    """Record clock-in punch for employee."""
    today = date.today()
    existing = (
        db.query(AttendanceDB)
        .filter(AttendanceDB.emp_id == emp_id, AttendanceDB.attendance_date == today)
        .first()
    )

    now = datetime.now()

    if existing:
        if existing.clock_in and existing.clock_out is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already clocked in today and your shift is currently active.",
            )
        # If previously clocked out, allow re-clocking in by resetting clock_out or updating
        existing.clock_out = None
        existing.work_mode = work_mode
        if notes:
            existing.notes = (f"{existing.notes} | {notes}") if existing.notes else notes
        db.commit()
        db.refresh(existing)
        return _to_attendance_out(existing)

    is_late, late_mins = _check_is_late(now)
    record_status = "present"
    if work_mode.lower() in ("remote", "wfh"):
        record_status = "wfh"
    elif is_late:
        record_status = "late"

    new_attendance = AttendanceDB(
        emp_id=emp_id,
        attendance_date=today,
        clock_in=now,
        status=record_status,
        work_mode=work_mode,
        is_late=is_late,
        late_minutes=late_mins,
        notes=notes,
        ip_address=ip_address,
        device_info=device_info,
    )
    db.add(new_attendance)
    db.commit()
    db.refresh(new_attendance)

    # Dispatch notification to employee
    try:
        dispatch_notification(
            db,
            user_id=None,
            emp_id=emp_id,
            notif_type="attendance",
            title="Clocked In Successfully",
            message=f"Punched in at {now.strftime('%I:%M %p')}. Status: {record_status.upper()}.",
            link="/attendance",
        )
    except Exception:
        pass

    return _to_attendance_out(new_attendance)


def clock_out_employee(
    db: Session,
    emp_id: int,
    notes: Optional[str] = None,
) -> AttendanceOut:
    """Record clock-out punch for employee, auto-ending any open break and calculating hours."""
    today = date.today()
    record = (
        db.query(AttendanceDB)
        .filter(AttendanceDB.emp_id == emp_id, AttendanceDB.attendance_date == today)
        .first()
    )

    if not record or not record.clock_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot clock out: No active clock-in recorded for today.",
        )

    if record.clock_out is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Already clocked out at {record.clock_out.strftime('%I:%M %p')}.",
        )

    now = datetime.now()

    # Automatically close any open breaks before clocking out
    for b in record.breaks:
        if b.end_time is None:
            b.end_time = now
            b.duration_minutes = max(1, int((now - b.start_time).total_seconds() / 60))

    total_break_mins = sum(b.duration_minutes for b in record.breaks)
    total_hours, reg_hours, ot_hours, is_half_day = _calculate_work_metrics(
        record.clock_in, now, total_break_mins
    )

    record.clock_out = now
    record.total_hours = total_hours
    record.regular_hours = reg_hours
    record.overtime_hours = ot_hours
    record.is_half_day = is_half_day

    if is_half_day and record.status not in ("on_leave", "holiday"):
        record.status = "half_day"

    if notes:
        record.notes = (f"{record.notes} | {notes}") if record.notes else notes

    db.commit()
    db.refresh(record)

    try:
        dispatch_notification(
            db,
            user_id=None,
            emp_id=emp_id,
            notif_type="attendance",
            title="Clocked Out Successfully",
            message=f"Punched out at {now.strftime('%I:%M %p')}. Total worked: {total_hours} hrs.",
            link="/attendance",
        )
    except Exception:
        pass

    return _to_attendance_out(record)


def start_break(
    db: Session,
    emp_id: int,
    break_type: str = "lunch",
    notes: Optional[str] = None,
) -> AttendanceBreakOut:
    """Start a designated break during active shift."""
    today = date.today()
    record = (
        db.query(AttendanceDB)
        .filter(AttendanceDB.emp_id == emp_id, AttendanceDB.attendance_date == today)
        .first()
    )

    if not record or not record.clock_in or record.clock_out is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start break: You must have an active, ongoing clock-in shift.",
        )

    # Verify no open break
    for b in record.breaks:
        if b.end_time is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Already on an active {b.break_type} break started at {b.start_time.strftime('%I:%M %p')}.",
            )

    new_break = AttendanceBreakDB(
        attendance_id=record.id,
        break_type=break_type,
        start_time=datetime.now(),
        notes=notes,
    )
    db.add(new_break)
    db.commit()
    db.refresh(new_break)
    return AttendanceBreakOut.model_validate(new_break)


def end_break(
    db: Session,
    emp_id: int,
    notes: Optional[str] = None,
) -> AttendanceBreakOut:
    """End the currently active break and resume work."""
    today = date.today()
    record = (
        db.query(AttendanceDB)
        .filter(AttendanceDB.emp_id == emp_id, AttendanceDB.attendance_date == today)
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No attendance shift recorded for today.",
        )

    open_break = next((b for b in record.breaks if b.end_time is None), None)
    if not open_break:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active break found to end.",
        )

    now = datetime.now()
    open_break.end_time = now
    diff_sec = (now - open_break.start_time).total_seconds()
    open_break.duration_minutes = max(1, int(diff_sec / 60))
    if notes:
        open_break.notes = (f"{open_break.notes} | {notes}") if open_break.notes else notes

    db.commit()
    db.refresh(open_break)
    return AttendanceBreakOut.model_validate(open_break)


def get_today_status(db: Session, emp: EmployeeDB) -> AttendanceTodayStatus:
    """Retrieve today's live punch status for employee."""
    today = date.today()
    record = (
        db.query(AttendanceDB)
        .filter(AttendanceDB.emp_id == emp.Emp_ID, AttendanceDB.attendance_date == today)
        .first()
    )

    emp_name = f"{emp.F_Name} {emp.L_Name}".strip()
    if not record:
        return AttendanceTodayStatus(
            emp_id=emp.Emp_ID,
            employee_name=emp_name,
            is_clocked_in=False,
            is_clocked_out=False,
            is_on_break=False,
            work_mode="office",
        )

    now = datetime.now()
    open_break = next((b for b in record.breaks if b.end_time is None), None)
    is_on_break = open_break is not None
    current_break_type = open_break.break_type if open_break else None

    is_clocked_in = record.clock_in is not None and record.clock_out is None
    is_clocked_out = record.clock_out is not None

    total_break_mins = sum(
        b.duration_minutes if b.end_time is not None
        else int((now - b.start_time).total_seconds() / 60)
        for b in record.breaks
    )

    active_duration_sec = 0
    if is_clocked_in:
        gross_sec = (now - record.clock_in).total_seconds()
        active_duration_sec = max(0, int(gross_sec - (total_break_mins * 60)))
    elif is_clocked_out and record.clock_in:
        gross_sec = (record.clock_out - record.clock_in).total_seconds()
        active_duration_sec = max(0, int(gross_sec - (total_break_mins * 60)))

    return AttendanceTodayStatus(
        emp_id=emp.Emp_ID,
        employee_name=emp_name,
        is_clocked_in=is_clocked_in,
        is_clocked_out=is_clocked_out,
        is_on_break=is_on_break,
        current_break_type=current_break_type,
        clock_in_time=record.clock_in,
        clock_out_time=record.clock_out,
        active_duration_seconds=active_duration_sec,
        total_break_minutes=total_break_mins,
        status=record.status,
        work_mode=record.work_mode,
        today_record=_to_attendance_out(record),
    )


# =========================================================================
# Attendance History & Summary Analytics
# =========================================================================

def get_employee_attendance_history(
    db: Session,
    emp_id: int,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    status_filter: Optional[str] = None,
) -> List[AttendanceOut]:
    """Retrieve chronological attendance history for a single employee."""
    query = db.query(AttendanceDB).filter(AttendanceDB.emp_id == emp_id)

    if from_date:
        query = query.filter(AttendanceDB.attendance_date >= from_date)
    if to_date:
        query = query.filter(AttendanceDB.attendance_date <= to_date)
    if status_filter and status_filter.lower() != "all":
        query = query.filter(func.lower(AttendanceDB.status) == status_filter.lower())

    records = query.order_by(AttendanceDB.attendance_date.desc()).all()
    return [_to_attendance_out(r) for r in records]


def calculate_monthly_kpis(
    db: Session,
    emp_id: int,
    year: int,
    month: int,
) -> AttendanceSummaryKPIs:
    """Compute monthly metrics, on-time punctuality rate, and overtime hours."""
    first_day = date(year, month, 1)
    if month == 12:
        last_day = date(year, 12, 31)
    else:
        last_day = date(year, month + 1, 1) - timedelta(days=1)

    today = date.today()
    capped_last_day = min(last_day, today)

    records = (
        db.query(AttendanceDB)
        .filter(
            AttendanceDB.emp_id == emp_id,
            AttendanceDB.attendance_date >= first_day,
            AttendanceDB.attendance_date <= last_day,
        )
        .all()
    )

    holidays = (
        db.query(HolidayDB)
        .filter(
            HolidayDB.holiday_date >= first_day,
            HolidayDB.holiday_date <= last_day,
        )
        .all()
    )
    holiday_dates = {h.holiday_date for h in holidays}

    total_calendar_days = last_day.day
    working_days_so_far = 0
    curr = first_day
    while curr <= capped_last_day:
        if curr.weekday() < 5 and curr not in holiday_dates:  # Monday to Friday
            working_days_so_far += 1
        curr += timedelta(days=1)

    present_days = sum(1 for r in records if r.status in ("present", "late", "half_day", "wfh"))
    late_days = sum(1 for r in records if r.is_late or r.status == "late")
    half_days = sum(1 for r in records if r.is_half_day or r.status == "half_day")
    on_leave_days = sum(1 for r in records if r.status == "on_leave")
    holiday_days = sum(1 for r in records if r.status == "holiday")
    on_time_days = max(0, present_days - late_days)

    absent_days = max(0, working_days_so_far - present_days - on_leave_days)

    total_work_hours = round(sum(float(r.total_hours or 0.0) for r in records), 2)
    total_overtime_hours = round(sum(float(r.overtime_hours or 0.0) for r in records), 2)
    avg_daily_hours = round(total_work_hours / present_days, 2) if present_days > 0 else 0.0
    on_time_rate = round((on_time_days / present_days) * 100, 1) if present_days > 0 else 100.0

    return AttendanceSummaryKPIs(
        month=month,
        year=year,
        total_calendar_days=total_calendar_days,
        working_days_so_far=working_days_so_far,
        present_days=present_days,
        on_time_days=on_time_days,
        late_days=late_days,
        half_days=half_days,
        absent_days=absent_days,
        on_leave_days=on_leave_days,
        holiday_days=holiday_days,
        total_work_hours=total_work_hours,
        total_overtime_hours=total_overtime_hours,
        avg_daily_hours=avg_daily_hours,
        on_time_rate_pct=on_time_rate,
    )


# =========================================================================
# Manager & Admin Team Live Roster
# =========================================================================

def get_team_live_roster(
    db: Session,
    dept_id: Optional[int] = None,
    status_filter: Optional[str] = None,
) -> TeamLiveRoster:
    """Retrieve today's real-time team presence roster across employees."""
    today = date.today()
    now = datetime.now()

    emp_query = db.query(EmployeeDB).filter(EmployeeDB.is_active == True)
    if dept_id:
        emp_query = emp_query.filter(EmployeeDB.Dept_ID == dept_id)
    employees = emp_query.order_by(EmployeeDB.F_Name.asc()).all()

    emp_ids = [e.Emp_ID for e in employees]
    today_records = (
        db.query(AttendanceDB)
        .filter(AttendanceDB.attendance_date == today, AttendanceDB.emp_id.in_(emp_ids))
        .all()
    ) if emp_ids else []
    record_map: Dict[int, AttendanceDB] = {r.emp_id: r for r in today_records}

    members: List[TeamLiveMember] = []
    currently_working = 0
    currently_on_break = 0
    clocked_out_today = 0
    not_in_yet = 0

    for emp in employees:
        rec = record_map.get(emp.Emp_ID)
        dept_name = emp.department.Dept_Name if emp.department else f"Dept #{emp.Dept_ID}"
        emp_name = f"{emp.F_Name} {emp.L_Name}".strip()

        if not rec or not rec.clock_in:
            live_status = "not_in_yet"
            not_in_yet += 1
            clock_in = None
            clock_out = None
            is_late = False
            late_mins = 0
            active_sec = 0
            cur_break = None
            work_mode = None
        else:
            clock_in = rec.clock_in
            clock_out = rec.clock_out
            is_late = rec.is_late
            late_mins = rec.late_minutes
            work_mode = rec.work_mode

            open_break = next((b for b in rec.breaks if b.end_time is None), None)
            total_break_mins = sum(
                b.duration_minutes if b.end_time is not None
                else int((now - b.start_time).total_seconds() / 60)
                for b in rec.breaks
            )

            if clock_out is not None:
                live_status = "clocked_out"
                clocked_out_today += 1
                cur_break = None
                gross_sec = (clock_out - clock_in).total_seconds()
                active_sec = max(0, int(gross_sec - (total_break_mins * 60)))
            elif open_break is not None:
                live_status = "on_break"
                currently_on_break += 1
                cur_break = open_break.break_type
                gross_sec = (now - clock_in).total_seconds()
                active_sec = max(0, int(gross_sec - (total_break_mins * 60)))
            else:
                live_status = "working"
                currently_working += 1
                cur_break = None
                gross_sec = (now - clock_in).total_seconds()
                active_sec = max(0, int(gross_sec - (total_break_mins * 60)))

        member = TeamLiveMember(
            emp_id=emp.Emp_ID,
            employee_name=emp_name,
            department_id=emp.Dept_ID,
            department_name=dept_name,
            status=live_status,
            work_mode=work_mode,
            clock_in=clock_in,
            clock_out=clock_out,
            is_late=is_late,
            late_minutes=late_mins,
            active_duration_seconds=active_sec,
            current_break_type=cur_break,
        )

        if status_filter and status_filter.lower() != "all":
            if live_status.lower() == status_filter.lower():
                members.append(member)
        else:
            members.append(member)

    return TeamLiveRoster(
        total_employees=len(employees),
        currently_working=currently_working,
        currently_on_break=currently_on_break,
        clocked_out_today=clocked_out_today,
        not_in_yet=not_in_yet,
        members=members,
    )


# =========================================================================
# Attendance Regularization Requests
# =========================================================================

def create_regularization_request(
    db: Session,
    emp_id: int,
    req: AttendanceRegularizeCreate,
) -> AttendanceRegularizeOut:
    """Submit a missed punch / attendance correction request."""
    if req.requested_clock_out and req.requested_clock_out <= req.requested_clock_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requested clock-out time must be after clock-in time.",
        )

    # Check for existing pending request for this date
    existing = (
        db.query(AttendanceRegularizationDB)
        .filter(
            AttendanceRegularizationDB.emp_id == emp_id,
            AttendanceRegularizationDB.attendance_date == req.attendance_date,
            AttendanceRegularizationDB.status == "pending",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You already have a pending regularization request for {req.attendance_date}.",
        )

    new_req = AttendanceRegularizationDB(
        emp_id=emp_id,
        attendance_date=req.attendance_date,
        requested_clock_in=req.requested_clock_in,
        requested_clock_out=req.requested_clock_out,
        reason=req.reason.strip(),
        status="pending",
    )
    db.add(new_req)
    db.commit()
    db.refresh(new_req)

    emp = db.query(EmployeeDB).filter(EmployeeDB.Emp_ID == emp_id).first()
    emp_name = f"{emp.F_Name} {emp.L_Name}".strip() if emp else f"Emp #{emp_id}"

    return AttendanceRegularizeOut(
        id=new_req.id,
        emp_id=new_req.emp_id,
        employee_name=emp_name,
        attendance_date=new_req.attendance_date,
        requested_clock_in=new_req.requested_clock_in,
        requested_clock_out=new_req.requested_clock_out,
        reason=new_req.reason,
        status=new_req.status,
        reviewed_by=new_req.reviewed_by,
        reviewed_at=new_req.reviewed_at,
        review_notes=new_req.review_notes,
        created_at=new_req.created_at,
    )


def review_regularization_request(
    db: Session,
    req_id: int,
    review: AttendanceRegularizeReview,
    reviewer_username: str,
) -> AttendanceRegularizeOut:
    """Approve or reject an attendance regularization request."""
    req = db.query(AttendanceRegularizationDB).filter(AttendanceRegularizationDB.id == req_id).first()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Regularization request not found.",
        )

    if req.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request has already been reviewed ({req.status}).",
        )

    now = datetime.now()
    req.status = review.status
    req.reviewed_by = reviewer_username
    req.reviewed_at = now
    req.review_notes = review.review_notes

    # If approved, update or insert AttendanceDB record
    if review.status == "approved":
        attendance = (
            db.query(AttendanceDB)
            .filter(
                AttendanceDB.emp_id == req.emp_id,
                AttendanceDB.attendance_date == req.attendance_date,
            )
            .first()
        )

        is_late, late_mins = _check_is_late(req.requested_clock_in)
        total_hours, reg_hours, ot_hours, is_half_day = _calculate_work_metrics(
            req.requested_clock_in, req.requested_clock_out, 0
        )

        status_str = "present"
        if is_half_day:
            status_str = "half_day"
        elif is_late:
            status_str = "late"

        if attendance:
            attendance.clock_in = req.requested_clock_in
            attendance.clock_out = req.requested_clock_out
            attendance.total_hours = total_hours
            attendance.regular_hours = reg_hours
            attendance.overtime_hours = ot_hours
            attendance.is_late = is_late
            attendance.late_minutes = late_mins
            attendance.is_half_day = is_half_day
            attendance.status = status_str
            attendance.notes = (
                f"Regularized by {reviewer_username}: {req.reason}"
            )
        else:
            new_att = AttendanceDB(
                emp_id=req.emp_id,
                attendance_date=req.attendance_date,
                clock_in=req.requested_clock_in,
                clock_out=req.requested_clock_out,
                total_hours=total_hours,
                regular_hours=reg_hours,
                overtime_hours=ot_hours,
                is_late=is_late,
                late_minutes=late_mins,
                is_half_day=is_half_day,
                status=status_str,
                work_mode="office",
                notes=f"Regularized by {reviewer_username}: {req.reason}",
            )
            db.add(new_att)

    db.commit()
    db.refresh(req)

    emp = db.query(EmployeeDB).filter(EmployeeDB.Emp_ID == req.emp_id).first()
    emp_name = f"{emp.F_Name} {emp.L_Name}".strip() if emp else f"Emp #{req.emp_id}"

    # Notify employee
    try:
        dispatch_notification(
            db,
            user_id=None,
            emp_id=req.emp_id,
            notif_type="attendance",
            title=f"Regularization {review.status.capitalize()}",
            message=f"Your request for {req.attendance_date} was {review.status} by {reviewer_username}.",
            link="/attendance",
        )
    except Exception:
        pass

    return AttendanceRegularizeOut(
        id=req.id,
        emp_id=req.emp_id,
        employee_name=emp_name,
        attendance_date=req.attendance_date,
        requested_clock_in=req.requested_clock_in,
        requested_clock_out=req.requested_clock_out,
        reason=req.reason,
        status=req.status,
        reviewed_by=req.reviewed_by,
        reviewed_at=req.reviewed_at,
        review_notes=req.review_notes,
        created_at=req.created_at,
    )


# =========================================================================
# Attendance Exporters (CSV & PDF)
# =========================================================================

def generate_attendance_csv(records: List[AttendanceOut]) -> str:
    """Generate RFC 4180 compliant CSV export for attendance logs."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Record ID",
        "Employee ID",
        "Employee Name",
        "Department",
        "Date",
        "Clock In",
        "Clock Out",
        "Status",
        "Work Mode",
        "Total Hours",
        "Regular Hours",
        "Overtime Hours",
        "Late Arrival",
        "Late Minutes",
        "Half Day",
        "Breaks Count",
        "Notes",
    ])

    for r in records:
        writer.writerow([
            r.id,
            r.emp_id,
            r.employee_name or "",
            r.department_name or "",
            r.attendance_date.isoformat(),
            r.clock_in.strftime("%H:%M:%S") if r.clock_in else "",
            r.clock_out.strftime("%H:%M:%S") if r.clock_out else "",
            r.status.upper(),
            r.work_mode.upper(),
            f"{r.total_hours:.2f}",
            f"{r.regular_hours:.2f}",
            f"{r.overtime_hours:.2f}",
            "YES" if r.is_late else "NO",
            r.late_minutes,
            "YES" if r.is_half_day else "NO",
            len(r.breaks),
            r.notes or "",
        ])

    return output.getvalue()


def generate_attendance_pdf(
    records: List[AttendanceOut],
    kpis: Optional[AttendanceSummaryKPIs] = None,
    title: str = "Employee Attendance & Timesheet Statement",
    subtitle: str = "Official Workforce Time-Tracking Report",
) -> bytes:
    """Generate high-fidelity, corporate ReportLab PDF timesheet statement."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=24,
        rightMargin=24,
        topMargin=24,
        bottomMargin=24,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "AttTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        fontName="Helvetica-Bold",
    )
    sub_style = ParagraphStyle(
        "AttSub",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#64748b"),
    )
    cell_hdr = ParagraphStyle(
        "AttCellHdr",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#ffffff"),
    )
    cell_txt = ParagraphStyle(
        "AttCellTxt",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=9,
        fontName="Helvetica",
        textColor=colors.HexColor("#1e293b"),
    )

    elements = []
    elements.append(Paragraph(title, title_style))
    elements.append(Paragraph(f"{subtitle} · Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", sub_style))
    elements.append(Spacer(1, 14))

    # Summary KPI Box if provided
    if kpis:
        kpi_data = [
            [
                Paragraph("<b>Present Days</b>", sub_style),
                Paragraph("<b>On-Time Rate</b>", sub_style),
                Paragraph("<b>Late Arrivals</b>", sub_style),
                Paragraph("<b>Half Days</b>", sub_style),
                Paragraph("<b>Total Work Hours</b>", sub_style),
                Paragraph("<b>Overtime Hours</b>", sub_style),
            ],
            [
                Paragraph(f"<font size=12><b>{kpis.present_days}</b> / {kpis.working_days_so_far}</font>", title_style),
                Paragraph(f"<font size=12><b>{kpis.on_time_rate_pct:.1f}%</b></font>", title_style),
                Paragraph(f"<font size=12><b>{kpis.late_days}</b></font>", title_style),
                Paragraph(f"<font size=12><b>{kpis.half_days}</b></font>", title_style),
                Paragraph(f"<font size=12><b>{kpis.total_work_hours:.1f}h</b></font>", title_style),
                Paragraph(f"<font size=12><b>{kpis.total_overtime_hours:.1f}h</b></font>", title_style),
            ]
        ]
        kpi_table = Table(kpi_data, colWidths=[120, 120, 120, 120, 140, 140])
        kpi_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(kpi_table)
        elements.append(Spacer(1, 14))

    # Records Table
    hdr = [
        Paragraph("Date", cell_hdr),
        Paragraph("Employee", cell_hdr),
        Paragraph("Department", cell_hdr),
        Paragraph("Clock In", cell_hdr),
        Paragraph("Clock Out", cell_hdr),
        Paragraph("Work Mode", cell_hdr),
        Paragraph("Hours", cell_hdr),
        Paragraph("OT (hrs)", cell_hdr),
        Paragraph("Punctuality", cell_hdr),
        Paragraph("Status", cell_hdr),
    ]
    rows = [hdr]

    for r in records[:300]:  # Cap at 300 to ensure reasonable PDF size
        punctuality = f"Late ({r.late_minutes}m)" if r.is_late else "On Time"
        clock_in_str = r.clock_in.strftime("%I:%M %p") if r.clock_in else "—"
        clock_out_str = r.clock_out.strftime("%I:%M %p") if r.clock_out else "—"

        rows.append([
            Paragraph(r.attendance_date.strftime("%d %b %Y"), cell_txt),
            Paragraph(r.employee_name or f"#{r.emp_id}", cell_txt),
            Paragraph(r.department_name or "—", cell_txt),
            Paragraph(clock_in_str, cell_txt),
            Paragraph(clock_out_str, cell_txt),
            Paragraph(r.work_mode.capitalize(), cell_txt),
            Paragraph(f"{r.total_hours:.2f}h", cell_txt),
            Paragraph(f"{r.overtime_hours:.2f}h", cell_txt),
            Paragraph(punctuality, cell_txt),
            Paragraph(r.status.upper(), cell_txt),
        ])

    table = Table(
        rows,
        colWidths=[70, 110, 100, 75, 75, 70, 60, 60, 85, 75],
        repeatRows=1,
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3b5bdb")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(table)

    doc.build(elements)
    return buf.getvalue()


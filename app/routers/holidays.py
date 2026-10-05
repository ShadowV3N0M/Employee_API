"""Holiday calendar, business day calculation, and company announcements router."""
from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    get_current_user,
    require_admin,
    require_manager_or_admin,
)
from app.config import limiter
from app.database import get_db
from app.models.department import DepartmentDB
from app.models.holiday import AnnouncementDB, HolidayDB
from app.models.user import UserDB
from app.schemas.holiday import (
    AnnouncementCreate,
    AnnouncementOut,
    AnnouncementUpdate,
    BusinessDaysResponse,
    HolidayCreate,
    HolidayOut,
    HolidayUpdate,
)

router = APIRouter(prefix="", tags=["Holidays & Announcements"])


def _holiday_to_out(h: HolidayDB) -> HolidayOut:
    today = date.today()
    days_left = (h.holiday_date - today).days
    day_name = h.holiday_date.strftime("%A")
    return HolidayOut(
        id=h.id,
        name=h.name,
        holiday_date=h.holiday_date,
        holiday_type=h.holiday_type,
        description=h.description,
        created_at=h.created_at,
        day_of_week=day_name,
        days_remaining=days_left,
    )


def _announcement_to_out(a: AnnouncementDB, db: Session) -> AnnouncementOut:
    dept_name = None
    if a.target_dept_id:
        dept = db.query(DepartmentDB).filter(DepartmentDB.Dept_ID == a.target_dept_id).first()
        if dept:
            dept_name = dept.Dept_Name

    return AnnouncementOut(
        id=a.id,
        title=a.title,
        content=a.content,
        priority=a.priority,
        target_dept_id=a.target_dept_id,
        target_dept_name=dept_name,
        is_pinned=a.is_pinned,
        published_by=a.published_by,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


# =========================================================================
# Holidays Endpoints
# =========================================================================

@router.get("/holidays", response_model=List[HolidayOut])
@limiter.limit("60/minute")
def list_holidays(
    request: Request,
    year: Optional[int] = Query(None, description="Filter by year (e.g. 2026)"),
    type: Optional[str] = Query(None, description="Filter by holiday type"),
    search: Optional[str] = Query(None, description="Search holiday name or description"),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Retrieve holidays with optional year, type, and keyword search filters."""
    query = db.query(HolidayDB)

    if year:
        start_year = date(year, 1, 1)
        end_year = date(year, 12, 31)
        query = query.filter(HolidayDB.holiday_date >= start_year, HolidayDB.holiday_date <= end_year)

    if type and type != "all":
        query = query.filter(HolidayDB.holiday_type == type)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(HolidayDB.name.ilike(term), HolidayDB.description.ilike(term)))

    holidays = query.order_by(HolidayDB.holiday_date.asc()).all()
    return [_holiday_to_out(h) for h in holidays]


@router.get("/holidays/upcoming", response_model=List[HolidayOut])
@limiter.limit("60/minute")
def upcoming_holidays(
    request: Request,
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Retrieve upcoming holidays from today forward."""
    today = date.today()
    holidays = (
        db.query(HolidayDB)
        .filter(HolidayDB.holiday_date >= today)
        .order_by(HolidayDB.holiday_date.asc())
        .limit(limit)
        .all()
    )
    return [_holiday_to_out(h) for h in holidays]


@router.get("/holidays/business-days", response_model=BusinessDaysResponse)
@limiter.limit("30/minute")
def calculate_business_days(
    request: Request,
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Calculates exact working business days between two dates, automatically
    deducting weekend days (Saturdays and Sundays) and gazetted holidays.
    Feeds leave application business logic.
    """
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")

    # Fetch holidays falling in date range
    holidays_in_range = (
        db.query(HolidayDB)
        .filter(HolidayDB.holiday_date >= start_date, HolidayDB.holiday_date <= end_date)
        .order_by(HolidayDB.holiday_date.asc())
        .all()
    )
    holiday_date_set = {h.holiday_date for h in holidays_in_range}

    total_days = (end_date - start_date).days + 1
    weekend_days = 0
    holiday_days = 0
    business_days = 0

    curr = start_date
    while curr <= end_date:
        is_weekend = curr.weekday() in (5, 6)  # 5=Sat, 6=Sun
        is_holiday = curr in holiday_date_set

        if is_weekend:
            weekend_days += 1
        elif is_holiday:
            holiday_days += 1
        else:
            business_days += 1

        curr += timedelta(days=1)

    return BusinessDaysResponse(
        start_date=start_date,
        end_date=end_date,
        total_calendar_days=total_days,
        weekend_days=weekend_days,
        holiday_days=holiday_days,
        business_days=business_days,
        holidays=[_holiday_to_out(h) for h in holidays_in_range],
    )


@router.post("/holidays", response_model=HolidayOut)
@limiter.limit("20/minute")
def create_holiday(
    request: Request,
    payload: HolidayCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin),
):
    """Admin only. Create a new corporate or public holiday."""
    existing = (
        db.query(HolidayDB)
        .filter(HolidayDB.holiday_date == payload.holiday_date, HolidayDB.name == payload.name)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Holiday '{payload.name}' on {payload.holiday_date} already exists",
        )

    new_h = HolidayDB(
        name=payload.name.strip(),
        holiday_date=payload.holiday_date,
        holiday_type=payload.holiday_type.strip(),
        description=payload.description.strip() if payload.description else None,
    )
    db.add(new_h)
    db.commit()
    db.refresh(new_h)
    return _holiday_to_out(new_h)


@router.put("/holidays/{holiday_id}", response_model=HolidayOut)
@limiter.limit("20/minute")
def update_holiday(
    request: Request,
    holiday_id: int,
    payload: HolidayUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin),
):
    """Admin only. Update an existing holiday."""
    holiday = db.query(HolidayDB).filter(HolidayDB.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    if payload.name is not None:
        holiday.name = payload.name.strip()
    if payload.holiday_date is not None:
        holiday.holiday_date = payload.holiday_date
    if payload.holiday_type is not None:
        holiday.holiday_type = payload.holiday_type.strip()
    if payload.description is not None:
        holiday.description = payload.description.strip() if payload.description else None

    db.commit()
    db.refresh(holiday)
    return _holiday_to_out(holiday)


@router.delete("/holidays/{holiday_id}")
@limiter.limit("20/minute")
def delete_holiday(
    request: Request,
    holiday_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin),
):
    """Admin only. Remove a holiday."""
    holiday = db.query(HolidayDB).filter(HolidayDB.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    db.delete(holiday)
    db.commit()
    return {"message": f"Holiday '{holiday.name}' deleted successfully"}


@router.post("/holidays/seed-defaults")
@limiter.limit("5/minute")
def seed_default_holidays(
    request: Request,
    year: int = Query(2026, description="Year to seed (default 2026)"),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin),
):
    """
    Admin only. Seeds standard corporate & gazetted national holidays
    for the specified year if not already present.
    """
    default_holidays_2026 = [
        {"name": "New Year's Day", "date": date(2026, 1, 1), "type": "Company", "desc": "Celebration of the New Year"},
        {"name": "Republic Day", "date": date(2026, 1, 26), "type": "National", "desc": "Honoring the Constitution of India"},
        {"name": "Maha Shivratri", "date": date(2026, 2, 16), "type": "Festival", "desc": "Festival of Lord Shiva"},
        {"name": "Holi", "date": date(2026, 3, 4), "type": "Festival", "desc": "Festival of Colors"},
        {"name": "Id-ul-Fitr", "date": date(2026, 3, 21), "type": "Festival", "desc": "Celebration concluding Ramadan"},
        {"name": "Good Friday", "date": date(2026, 4, 3), "type": "National", "desc": "Christian observance of the Crucifixion"},
        {"name": "Mahavir Jayanti", "date": date(2026, 4, 1), "type": "Festival", "desc": "Birth anniversary of Lord Mahavira"},
        {"name": "Buddha Purnima", "date": date(2026, 5, 2), "type": "Festival", "desc": "Birth of Gautama Buddha"},
        {"name": "Bakrid / Eid al-Adha", "date": date(2026, 5, 28), "type": "Festival", "desc": "Feast of the Sacrifice"},
        {"name": "Muharram", "date": date(2026, 6, 27), "type": "Festival", "desc": "First month of Islamic calendar"},
        {"name": "Independence Day", "date": date(2026, 8, 15), "type": "National", "desc": "Commemoration of Indian Independence"},
        {"name": "Milad-un-Nabi", "date": date(2026, 8, 26), "type": "Festival", "desc": "Prophet Muhammad's Birthday"},
        {"name": "Mahatma Gandhi Jayanti", "date": date(2026, 10, 2), "type": "National", "desc": "Birth anniversary of Mahatma Gandhi"},
        {"name": "Dussehra (Vijayadashami)", "date": date(2026, 10, 20), "type": "Festival", "desc": "Victory of Good over Evil"},
        {"name": "Diwali (Deepavali)", "date": date(2026, 11, 8), "type": "Festival", "desc": "Festival of Lights"},
        {"name": "Guru Nanak Jayanti", "date": date(2026, 11, 24), "type": "Festival", "desc": "Birth of Guru Nanak Dev Ji"},
        {"name": "Christmas Day", "date": date(2026, 12, 25), "type": "National", "desc": "Celebration of the Nativity of Jesus"},
    ]

    added = 0
    for h in default_holidays_2026:
        # adjust year if requested
        h_date = h["date"].replace(year=year)
        exists = db.query(HolidayDB).filter(HolidayDB.name == h["name"], HolidayDB.holiday_date == h_date).first()
        if not exists:
            db.add(HolidayDB(
                name=h["name"],
                holiday_date=h_date,
                holiday_type=h["type"],
                description=h["desc"],
            ))
            added += 1

    db.commit()
    return {"message": f"Successfully seeded {added} default holidays for year {year}.", "added_count": added}


# =========================================================================
# Announcements Endpoints
# =========================================================================

@router.get("/announcements", response_model=List[AnnouncementOut])
@limiter.limit("60/minute")
def list_announcements(
    request: Request,
    priority: Optional[str] = Query(None, description="Filter by priority: urgent, important, general, event"),
    dept_id: Optional[int] = Query(None, description="Filter by target department (includes company-wide)"),
    search: Optional[str] = Query(None, description="Search announcement title or content"),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Retrieve company announcements with priority and department filtering."""
    query = db.query(AnnouncementDB)

    if priority and priority != "all":
        query = query.filter(AnnouncementDB.priority == priority)

    if dept_id:
        # Include announcements targeted to this specific department OR company-wide (None)
        query = query.filter(or_(AnnouncementDB.target_dept_id == dept_id, AnnouncementDB.target_dept_id.is_(None)))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(AnnouncementDB.title.ilike(term), AnnouncementDB.content.ilike(term)))

    # Order: Pinned first, then newest first
    announcements = query.order_by(AnnouncementDB.is_pinned.desc(), AnnouncementDB.created_at.desc()).all()
    return [_announcement_to_out(a, db) for a in announcements]


@router.post("/announcements", response_model=AnnouncementOut)
@limiter.limit("20/minute")
def create_announcement(
    request: Request,
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_manager_or_admin),
):
    """Admin or Manager. Broadcast a new corporate announcement."""
    if payload.target_dept_id:
        dept = db.query(DepartmentDB).filter(DepartmentDB.Dept_ID == payload.target_dept_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail="Target department not found")

    new_a = AnnouncementDB(
        title=payload.title.strip(),
        content=payload.content.strip(),
        priority=payload.priority.strip() if payload.priority else "general",
        target_dept_id=payload.target_dept_id,
        is_pinned=payload.is_pinned,
        published_by=current_user.username,
    )
    db.add(new_a)
    db.commit()
    db.refresh(new_a)
    return _announcement_to_out(new_a, db)


@router.put("/announcements/{announcement_id}", response_model=AnnouncementOut)
@limiter.limit("20/minute")
def update_announcement(
    request: Request,
    announcement_id: int,
    payload: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_manager_or_admin),
):
    """Admin or Author. Update an existing announcement."""
    announcement = db.query(AnnouncementDB).filter(AnnouncementDB.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    # Author or admin check
    if current_user.role != "admin" and announcement.published_by != current_user.username:
        raise HTTPException(status_code=403, detail="You can only edit announcements you authored")

    if payload.title is not None:
        announcement.title = payload.title.strip()
    if payload.content is not None:
        announcement.content = payload.content.strip()
    if payload.priority is not None:
        announcement.priority = payload.priority.strip()
    if "target_dept_id" in payload.model_fields_set:
        if payload.target_dept_id:
            dept = db.query(DepartmentDB).filter(DepartmentDB.Dept_ID == payload.target_dept_id).first()
            if not dept:
                raise HTTPException(status_code=400, detail="Target department not found")
        announcement.target_dept_id = payload.target_dept_id
    if payload.is_pinned is not None:
        announcement.is_pinned = payload.is_pinned

    announcement.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(announcement)
    return _announcement_to_out(announcement, db)


@router.delete("/announcements/{announcement_id}")
@limiter.limit("20/minute")
def delete_announcement(
    request: Request,
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_manager_or_admin),
):
    """Admin or Author. Delete an announcement."""
    announcement = db.query(AnnouncementDB).filter(AnnouncementDB.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    if current_user.role != "admin" and announcement.published_by != current_user.username:
        raise HTTPException(status_code=403, detail="You can only delete announcements you authored")

    db.delete(announcement)
    db.commit()
    return {"message": "Announcement deleted successfully"}

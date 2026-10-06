"""Employee Self-Service Profile and Emergency Contacts router."""
from datetime import date, datetime
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_admin, require_manager_or_admin
from app.config import limiter
from app.database import get_db
from app.models.department import DepartmentDB
from app.models.employee import EmergencyContactDB, EmployeeDB
from app.models.user import UserDB
from app.schemas.profile import (
    EmergencyContactCreate,
    EmergencyContactOut,
    EmergencyContactUpdate,
    LinkUserEmployee,
    ProfileOut,
    ProfileSelfUpdate,
)
from app.services.notification_service import dispatch_notification

logger = logging.getLogger("profile")

router = APIRouter(prefix="", tags=["Employee Self-Service & Emergency Contacts"])


def resolve_user_employee(db: Session, user: UserDB) -> Optional[EmployeeDB]:
    """
    Finds the Employee record linked to a User account.
    Falls back to matching email or username and auto-links emp_id.
    """
    # 1. Direct explicit foreign key
    if user.emp_id:
        emp = db.query(EmployeeDB).filter(EmployeeDB.Emp_ID == user.emp_id).first()
        if emp:
            return emp

    # 2. Match by email
    if user.email:
        emp = db.query(EmployeeDB).filter(
            func.lower(EmployeeDB.Email) == func.lower(user.email)
        ).first()
        if emp:
            user.emp_id = emp.Emp_ID
            try:
                db.commit()
            except Exception:
                db.rollback()
            return emp

    # 3. Match by username (e.g. matching F_Name or corporate email prefix)
    emp = db.query(EmployeeDB).filter(
        or_(
            func.lower(EmployeeDB.F_Name) == func.lower(user.username),
            EmployeeDB.Email.ilike(f"{user.username}@%"),
        )
    ).first()
    if emp:
        user.emp_id = emp.Emp_ID
        try:
            db.commit()
        except Exception:
            db.rollback()
        return emp

    return None


def _to_profile_out(emp: EmployeeDB, user: UserDB, db: Session) -> ProfileOut:
    dept = db.query(DepartmentDB).filter(DepartmentDB.Dept_ID == emp.Dept_ID).first()
    dept_name = dept.Dept_Name if dept else f"Dept #{emp.Dept_ID}"

    contacts = (
        db.query(EmergencyContactDB)
        .filter(EmergencyContactDB.emp_id == emp.Emp_ID)
        .order_by(EmergencyContactDB.is_primary.desc(), EmergencyContactDB.id.asc())
        .all()
    )

    return ProfileOut(
        Emp_ID=emp.Emp_ID,
        F_Name=emp.F_Name,
        L_Name=emp.L_Name,
        Email=emp.Email,
        Dept_ID=emp.Dept_ID,
        department_name=dept_name,
        Address=emp.Address,
        joining_date=emp.joining_date,
        Salary=float(emp.Salary) if emp.Salary is not None else None,
        is_active=emp.is_active,
        created_at=emp.created_at,
        personal_phone=emp.personal_phone,
        blood_group=emp.blood_group,
        dob=emp.dob,
        marital_status=emp.marital_status,
        username=user.username,
        role=user.role,
        emergency_contacts=[EmergencyContactOut.model_validate(c) for c in contacts],
    )


# =========================================================================
# Self-Service Profile Endpoints
# =========================================================================

@router.get("/employees/me/profile", response_model=ProfileOut)
@limiter.limit("60/minute")
def get_my_profile(
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Authenticated employee views their own complete personal profile,
    compensation, organizational placement, and emergency contacts.
    """
    emp = resolve_user_employee(db, current_user)
    if not emp:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No employee record is linked to user account '{current_user.username}'. "
                f"Please contact an administrator to link your account."
            ),
        )

    return _to_profile_out(emp, current_user, db)


@router.put("/employees/me/profile", response_model=ProfileOut)
@limiter.limit("20/minute")
def update_my_profile(
    request: Request,
    payload: ProfileSelfUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Employee self-service update. Allows staff members to safely update
    non-privileged personal information: phone, blood group, date of birth,
    marital status, and residential address without altering salary or department.
    """
    emp = resolve_user_employee(db, current_user)
    if not emp:
        raise HTTPException(
            status_code=404,
            detail=f"No employee record is linked to user '{current_user.username}'",
        )

    updated_fields = []
    if payload.personal_phone is not None:
        emp.personal_phone = payload.personal_phone.strip() if payload.personal_phone else None
        updated_fields.append("Phone")

    if payload.blood_group is not None:
        emp.blood_group = payload.blood_group.strip().upper() if payload.blood_group else None
        updated_fields.append("Blood Group")

    if payload.dob is not None:
        emp.dob = payload.dob
        updated_fields.append("DOB")

    if payload.marital_status is not None:
        emp.marital_status = payload.marital_status.strip().title() if payload.marital_status else None
        updated_fields.append("Marital Status")

    if payload.Address is not None:
        addr = payload.Address.strip()
        if len(addr) < 5:
            raise HTTPException(status_code=400, detail="Address must be at least 5 characters")
        emp.Address = addr
        updated_fields.append("Residential Address")

    db.commit()
    db.refresh(emp)

    if updated_fields:
        try:
            dispatch_notification(
                db=db,
                title="👤 Profile Updated",
                message=f"You updated your personal details ({', '.join(updated_fields)}).",
                type="info",
                link="/profile",
                user_id=current_user.id,
            )
        except Exception:
            pass

    return _to_profile_out(emp, current_user, db)


# =========================================================================
# Self-Service Emergency Contacts Endpoints
# =========================================================================

@router.get("/employees/me/emergency-contacts", response_model=List[EmergencyContactOut])
@limiter.limit("60/minute")
def list_my_emergency_contacts(
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Retrieve list of emergency SOS contacts for the logged-in employee."""
    emp = resolve_user_employee(db, current_user)
    if not emp:
        raise HTTPException(status_code=404, detail="No linked employee record")

    contacts = (
        db.query(EmergencyContactDB)
        .filter(EmergencyContactDB.emp_id == emp.Emp_ID)
        .order_by(EmergencyContactDB.is_primary.desc(), EmergencyContactDB.id.asc())
        .all()
    )
    return [EmergencyContactOut.model_validate(c) for c in contacts]


@router.post("/employees/me/emergency-contacts", response_model=EmergencyContactOut)
@limiter.limit("20/minute")
def add_my_emergency_contact(
    request: Request,
    payload: EmergencyContactCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Add a new emergency contact for the logged-in employee."""
    emp = resolve_user_employee(db, current_user)
    if not emp:
        raise HTTPException(status_code=404, detail="No linked employee record")

    # If this is marked as primary, reset any existing primary flag
    if payload.is_primary:
        db.query(EmergencyContactDB).filter(
            EmergencyContactDB.emp_id == emp.Emp_ID
        ).update({"is_primary": False})

    new_contact = EmergencyContactDB(
        emp_id=emp.Emp_ID,
        contact_name=payload.contact_name.strip(),
        relationship_type=payload.relationship_type.strip(),
        phone_primary=payload.phone_primary.strip(),
        phone_secondary=payload.phone_secondary.strip() if payload.phone_secondary else None,
        is_primary=payload.is_primary,
    )
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return EmergencyContactOut.model_validate(new_contact)


@router.put("/employees/me/emergency-contacts/{contact_id}", response_model=EmergencyContactOut)
@limiter.limit("20/minute")
def update_my_emergency_contact(
    request: Request,
    contact_id: int,
    payload: EmergencyContactUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Update an existing emergency contact for the logged-in employee."""
    emp = resolve_user_employee(db, current_user)
    if not emp:
        raise HTTPException(status_code=404, detail="No linked employee record")

    contact = (
        db.query(EmergencyContactDB)
        .filter(EmergencyContactDB.id == contact_id, EmergencyContactDB.emp_id == emp.Emp_ID)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Emergency contact not found")

    if payload.contact_name is not None:
        contact.contact_name = payload.contact_name.strip()
    if payload.relationship_type is not None:
        contact.relationship_type = payload.relationship_type.strip()
    if payload.phone_primary is not None:
        contact.phone_primary = payload.phone_primary.strip()
    if payload.phone_secondary is not None:
        contact.phone_secondary = payload.phone_secondary.strip() if payload.phone_secondary else None
    if payload.is_primary is not None:
        if payload.is_primary:
            db.query(EmergencyContactDB).filter(
                EmergencyContactDB.emp_id == emp.Emp_ID,
                EmergencyContactDB.id != contact_id,
            ).update({"is_primary": False})
        contact.is_primary = payload.is_primary

    db.commit()
    db.refresh(contact)
    return EmergencyContactOut.model_validate(contact)


@router.delete("/employees/me/emergency-contacts/{contact_id}")
@limiter.limit("20/minute")
def delete_my_emergency_contact(
    request: Request,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Delete an emergency contact for the logged-in employee."""
    emp = resolve_user_employee(db, current_user)
    if not emp:
        raise HTTPException(status_code=404, detail="No linked employee record")

    contact = (
        db.query(EmergencyContactDB)
        .filter(EmergencyContactDB.id == contact_id, EmergencyContactDB.emp_id == emp.Emp_ID)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Emergency contact not found")

    db.delete(contact)
    db.commit()
    return {"message": "Emergency contact deleted successfully"}


# =========================================================================
# Manager & Admin Emergency Contacts (SOS Directory Lookup)
# =========================================================================

@router.get("/employees/{emp_id}/emergency-contacts", response_model=List[EmergencyContactOut])
@limiter.limit("60/minute")
def get_employee_emergency_contacts(
    request: Request,
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_manager_or_admin),
):
    """
    Manager or Admin. Look up emergency SOS contacts for any employee.
    Used for instant emergency medical/family outreach.
    """
    emp = db.query(EmployeeDB).filter(EmployeeDB.Emp_ID == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail=f"Employee #{emp_id} not found")

    contacts = (
        db.query(EmergencyContactDB)
        .filter(EmergencyContactDB.emp_id == emp_id)
        .order_by(EmergencyContactDB.is_primary.desc(), EmergencyContactDB.id.asc())
        .all()
    )
    return [EmergencyContactOut.model_validate(c) for c in contacts]


@router.post("/employees/{emp_id}/emergency-contacts", response_model=EmergencyContactOut)
@limiter.limit("20/minute")
def admin_add_emergency_contact(
    request: Request,
    emp_id: int,
    payload: EmergencyContactCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_manager_or_admin),
):
    """Manager or Admin. Add an emergency contact on behalf of an employee."""
    emp = db.query(EmployeeDB).filter(EmployeeDB.Emp_ID == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail=f"Employee #{emp_id} not found")

    if payload.is_primary:
        db.query(EmergencyContactDB).filter(
            EmergencyContactDB.emp_id == emp_id
        ).update({"is_primary": False})

    new_contact = EmergencyContactDB(
        emp_id=emp_id,
        contact_name=payload.contact_name.strip(),
        relationship_type=payload.relationship_type.strip(),
        phone_primary=payload.phone_primary.strip(),
        phone_secondary=payload.phone_secondary.strip() if payload.phone_secondary else None,
        is_primary=payload.is_primary,
    )
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return EmergencyContactOut.model_validate(new_contact)


@router.delete("/employees/{emp_id}/emergency-contacts/{contact_id}")
@limiter.limit("20/minute")
def admin_delete_emergency_contact(
    request: Request,
    emp_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_manager_or_admin),
):
    """Manager or Admin. Delete an employee emergency contact."""
    contact = (
        db.query(EmergencyContactDB)
        .filter(EmergencyContactDB.id == contact_id, EmergencyContactDB.emp_id == emp_id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Emergency contact not found")

    db.delete(contact)
    db.commit()
    return {"message": "Emergency contact deleted successfully"}


# =========================================================================
# Admin Account Link Utility
# =========================================================================

@router.post("/employees/link-user")
@limiter.limit("10/minute")
def link_user_to_employee(
    request: Request,
    payload: LinkUserEmployee,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin),
):
    """Admin only. Explicitly links a User account to an Employee record."""
    user = db.query(UserDB).filter(UserDB.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User ID #{payload.user_id} not found")

    emp = db.query(EmployeeDB).filter(EmployeeDB.Emp_ID == payload.emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail=f"Employee ID #{payload.emp_id} not found")

    user.emp_id = emp.Emp_ID
    db.commit()
    return {
        "message": f"Successfully linked user '{user.username}' to Employee #{emp.Emp_ID} ({emp.F_Name} {emp.L_Name})",
        "user_id": user.id,
        "emp_id": emp.Emp_ID,
    }

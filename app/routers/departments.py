from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_admin
from app.config import limiter
from app.database import get_db
from app.models.department import DepartmentDB, DepartmentHistoryDB
from app.models.employee import EmployeeDB
from app.models.user import UserDB
from app.schemas.department import (
    DepartmentBulkCreate,
    DepartmentCreate,
    DepartmentHistoryResponse,
    DepartmentUpdate,
)
from app.services.employee_service import employee_view

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.post("")
@limiter.limit("10/minute")
def create_department(
    request: Request,
    dept: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. Create a new company department."""
    try:
        existing = db.query(DepartmentDB).filter(
            func.lower(DepartmentDB.Dept_Name) == dept.Dept_Name.strip().lower()
        ).first()

        if existing:
            raise HTTPException(
                status_code=409, detail="Department already exists")

        new_dept = DepartmentDB(
            Dept_Name=dept.Dept_Name.strip(), Budget=dept.Budget)
        db.add(new_dept)
        db.flush()

        # Log creation history
        hist = DepartmentHistoryDB(
            Dept_ID=new_dept.Dept_ID,
            Dept_Name=new_dept.Dept_Name,
            old_budget=None,
            new_budget=float(new_dept.Budget) if new_dept.Budget is not None else None,
            old_name=None,
            new_name=new_dept.Dept_Name,
            change_type="CREATED",
            notes="Department created",
            changed_by=current_user.username,
        )
        db.add(hist)
        db.commit()
        db.refresh(new_dept)

        try:
            from app.services.notification_service import dispatch_notification
            dispatch_notification(
                db=db,
                title="🏛️ New Department Created",
                message=f"Department '{new_dept.Dept_Name}' (ID #{new_dept.Dept_ID}) was created.",
                type="department",
                link="/departments",
                broadcast=True,
            )
        except Exception:
            pass

        return new_dept

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.post("/bulk-create")
@limiter.limit("10/minute")
def bulk_create_departments(
    request: Request,
    payload: DepartmentBulkCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. Create multiple departments in a single batch."""
    if not payload.departments:
        raise HTTPException(
            status_code=400, detail="Departments list cannot be empty")

    created = []
    skipped = []

    try:
        for item in payload.departments:
            name = item.Dept_Name.strip()
            existing = db.query(DepartmentDB).filter(
                func.lower(DepartmentDB.Dept_Name) == name.lower()
            ).first()

            if existing:
                skipped.append({"name": name, "reason": "Already exists"})
                continue

            new_d = DepartmentDB(Dept_Name=name, Budget=item.Budget)
            db.add(new_d)
            db.flush()
            created.append(
                {"Dept_ID": new_d.Dept_ID, "Dept_Name": new_d.Dept_Name, "Budget": float(new_d.Budget or 0)})

        db.commit()
        return {
            "message": f"Successfully created {len(created)} department(s), {len(skipped)} skipped",
            "created": created,
            "skipped": skipped,
        }
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


DEPT_SORTABLE = {
    "Dept_ID": DepartmentDB.Dept_ID,
    "Dept_Name": DepartmentDB.Dept_Name,
    "Budget": DepartmentDB.Budget,
}


@router.get("")
def list_departments(
    search: Optional[str] = None,
    min_budget: Optional[float] = None,
    max_budget: Optional[float] = None,
    sort_by: str = "Dept_ID",
    order: str = "asc",
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Any authenticated user. Retrieve company departments with optional filtering and sorting."""
    try:
        query = db.query(DepartmentDB)

        if search and search.strip():
            s = search.strip()
            conds = [DepartmentDB.Dept_Name.ilike(f"%{s}%")]
            if s.isdigit():
                conds.append(DepartmentDB.Dept_ID == int(s))
            query = query.filter(or_(*conds))

        if min_budget is not None:
            query = query.filter(DepartmentDB.Budget >= min_budget)

        if max_budget is not None:
            query = query.filter(DepartmentDB.Budget <= max_budget)

        col = DEPT_SORTABLE.get(sort_by, DepartmentDB.Dept_ID)
        query = query.order_by(col.desc() if order == "desc" else col.asc())

        return query.all()
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.get("/{dept_id}")
def get_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Retrieve single department with headcount and budget analytics."""
    dept = db.query(DepartmentDB).filter(
        DepartmentDB.Dept_ID == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    # Count active employees
    headcount = db.query(func.count(EmployeeDB.Emp_ID)).filter(
        EmployeeDB.Dept_ID == dept_id,
        EmployeeDB.is_active == True  # noqa: E712
    ).scalar() or 0

    total_payroll = 0.0
    if current_user.role in ("admin", "manager"):
        total_payroll = float(db.query(func.sum(EmployeeDB.Salary)).filter(
            EmployeeDB.Dept_ID == dept_id,
            EmployeeDB.is_active == True  # noqa: E712
        ).scalar() or 0.0)

    res = {
        "Dept_ID": dept.Dept_ID,
        "Dept_Name": dept.Dept_Name,
        "Budget": float(dept.Budget) if dept.Budget is not None else None,
        "headcount": headcount,
    }
    if current_user.role in ("admin", "manager"):
        res["total_active_payroll"] = total_payroll
        if dept.Budget:
            res["budget_utilization_pct"] = round(
                (total_payroll / float(dept.Budget)) * 100, 2)

    return res


@router.get("/{dept_id}/employees")
def list_department_employees(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """List all employees in a specific department with RBAC field visibility."""
    dept = db.query(DepartmentDB).filter(
        DepartmentDB.Dept_ID == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    employees = db.query(EmployeeDB).filter(
        EmployeeDB.Dept_ID == dept_id,
        EmployeeDB.is_active == True  # noqa: E712
    ).all()

    return [employee_view(e, current_user.role) for e in employees]


@router.get("/history/all", response_model=list[DepartmentHistoryResponse])
def get_all_departments_history(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. Get full change and budget revision history across all departments."""
    try:
        return db.query(DepartmentHistoryDB).order_by(
            DepartmentHistoryDB.changed_at.desc(), DepartmentHistoryDB.id.desc()
        ).limit(200).all()
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.get("/{dept_id}/history", response_model=list[DepartmentHistoryResponse])
def get_department_history(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. Get change and budget revision history for a specific department."""
    dept = db.query(DepartmentDB).filter(
        DepartmentDB.Dept_ID == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    try:
        return db.query(DepartmentHistoryDB).filter(
            DepartmentHistoryDB.Dept_ID == dept_id
        ).order_by(DepartmentHistoryDB.changed_at.desc(), DepartmentHistoryDB.id.desc()).all()
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.put("/{dept_id}")
@limiter.limit("10/minute")
def update_department(
    request: Request,
    dept_id: int,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. Update a department's name or budget and record change history."""
    dept = db.query(DepartmentDB).filter(
        DepartmentDB.Dept_ID == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    try:
        old_name = dept.Dept_Name
        old_budget = float(dept.Budget) if dept.Budget is not None else None

        new_name = payload.Dept_Name.strip() if payload.Dept_Name and payload.Dept_Name.strip() else old_name
        new_budget = payload.Budget if payload.Budget is not None else old_budget

        if payload.Dept_Name is not None and payload.Dept_Name.strip():
            # Check unique name constraint
            name_check = db.query(DepartmentDB).filter(
                func.lower(
                    DepartmentDB.Dept_Name) == new_name.lower(),
                DepartmentDB.Dept_ID != dept_id
            ).first()
            if name_check:
                raise HTTPException(
                    status_code=409, detail="Another department already uses this name")
            dept.Dept_Name = new_name

        if payload.Budget is not None:
            if payload.Budget < 0:
                raise HTTPException(
                    status_code=400, detail="Budget cannot be negative")
            dept.Budget = new_budget

        has_name_change = (new_name != old_name)
        has_budget_change = (new_budget != old_budget)

        if has_name_change or has_budget_change:
            if has_name_change and has_budget_change:
                change_type = "NAME_AND_BUDGET_UPDATED"
            elif has_budget_change:
                change_type = "BUDGET_REVISED"
            else:
                change_type = "NAME_CHANGED"

            hist = DepartmentHistoryDB(
                Dept_ID=dept.Dept_ID,
                Dept_Name=new_name,
                old_budget=old_budget,
                new_budget=new_budget,
                old_name=old_name if has_name_change else None,
                new_name=new_name if has_name_change else None,
                change_type=change_type,
                notes=payload.notes.strip() if payload.notes and payload.notes.strip() else None,
                changed_by=current_user.username,
            )
            db.add(hist)

        db.commit()
        db.refresh(dept)
        return dept
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.delete("/{dept_id}")
@limiter.limit("10/minute")
def delete_department(
    request: Request,
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. Delete a department (prevented if employees are still assigned)."""
    dept = db.query(DepartmentDB).filter(
        DepartmentDB.Dept_ID == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    employee_count = db.query(func.count(EmployeeDB.Emp_ID)).filter(
        EmployeeDB.Dept_ID == dept_id
    ).scalar() or 0

    if employee_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete department '{dept.Dept_Name}': {employee_count} employee(s) are assigned to it. Reassign or delete them first."
        )

    try:
        # Detach prior history records to keep audit trail without FK violation
        db.query(DepartmentHistoryDB).filter(
            DepartmentHistoryDB.Dept_ID == dept_id
        ).update({"Dept_ID": None})

        # Record deletion event in history
        hist = DepartmentHistoryDB(
            Dept_ID=None,
            Dept_Name=dept.Dept_Name,
            old_budget=float(dept.Budget) if dept.Budget is not None else None,
            new_budget=None,
            old_name=dept.Dept_Name,
            new_name=None,
            change_type="DELETED",
            notes=f"Department '{dept.Dept_Name}' permanently deleted",
            changed_by=current_user.username,
        )
        db.add(hist)
        db.delete(dept)
        db.commit()
        return {"message": f"Department '{dept.Dept_Name}' (ID {dept_id}) deleted successfully"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")

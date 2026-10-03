from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin, require_manager_or_admin
from app.config import limiter
from app.database import get_db
from app.models.department import DepartmentDB
from app.models.employee import EmployeeDB, SalaryHistoryDB
from app.models.user import UserDB
from app.schemas.employee import BulkSalaryIncrement, SalaryIncrement, SalarySet

router = APIRouter(prefix="/employees", tags=["Salaries"])


@router.post("/salary/bulk-increment")
@limiter.limit("10/minute")
def bulk_salary_increment(
    request: Request,
    payload: BulkSalaryIncrement,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """
    Admin only. Apply a raise or cut across multiple employees.
    Supports fixed dollar adjustment (amount) or percentage increase (percentage).
    Optionally filter by dept_id or a list of emp_ids.
    """
    if payload.amount is None and payload.percentage is None:
        raise HTTPException(
            status_code=400,
            detail="Must specify either 'amount' (fixed value) or 'percentage' (e.g. 5 for 5%)"
        )

    query = db.query(EmployeeDB).filter(EmployeeDB.is_active == True)  # noqa: E712
    if payload.dept_id is not None:
        query = query.filter(EmployeeDB.Dept_ID == payload.dept_id)
    if payload.emp_ids:
        query = query.filter(EmployeeDB.Emp_ID.in_(payload.emp_ids))

    employees = query.all()
    if not employees:
        return {"message": "No active employees matched the criteria.", "updated_count": 0, "employees": []}

    updated = []
    try:
        for emp in employees:
            old_sal = float(emp.Salary)
            if payload.percentage is not None:
                adjustment = round(old_sal * (payload.percentage / 100.0), 2)
            else:
                adjustment = round(payload.amount, 2)  # type: ignore

            new_sal = round(old_sal + adjustment, 2)
            if new_sal < 0:
                new_sal = 0.0

            db.add(SalaryHistoryDB(
                Emp_ID=emp.Emp_ID,
                old_salary=old_sal,
                new_salary=new_sal,
                changed_by=current_user.username
            ))
            emp.Salary = new_sal
            updated.append({
                "Emp_ID": emp.Emp_ID,
                "Name": f"{emp.F_Name} {emp.L_Name}",
                "old_salary": old_sal,
                "new_salary": new_sal,
                "change": round(new_sal - old_sal, 2)
            })

        db.commit()
        return {
            "message": f"Successfully updated salary for {len(updated)} employee(s)",
            "updated_count": len(updated),
            "employees": updated
        }
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.get("/salary/summary")
def get_payroll_summary(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_manager_or_admin)
):
    """Manager/Admin only. Return company-wide and department-wise payroll analytics."""
    active_employees = db.query(EmployeeDB).filter(EmployeeDB.is_active == True).all()  # noqa: E712
    if not active_employees:
        return {
            "total_headcount": 0,
            "total_payroll": 0.0,
            "average_salary": 0.0,
            "min_salary": 0.0,
            "max_salary": 0.0,
            "departments": []
        }

    salaries = [float(e.Salary) for e in active_employees]
    total_payroll = sum(salaries)
    avg_salary = round(total_payroll / len(salaries), 2)
    min_salary = min(salaries)
    max_salary = max(salaries)

    depts = db.query(DepartmentDB).all()
    dept_stats = []
    for d in depts:
        d_emps = [e for e in active_employees if e.Dept_ID == d.Dept_ID]
        if d_emps:
            d_salaries = [float(e.Salary) for e in d_emps]
            d_total = sum(d_salaries)
            dept_stats.append({
                "Dept_ID": d.Dept_ID,
                "Dept_Name": d.Dept_Name,
                "headcount": len(d_emps),
                "total_payroll": round(d_total, 2),
                "average_salary": round(d_total / len(d_emps), 2),
                "budget": float(d.Budget) if d.Budget else None,
                "budget_utilization_pct": round((d_total / float(d.Budget)) * 100, 2) if d.Budget else None
            })
        else:
            dept_stats.append({
                "Dept_ID": d.Dept_ID,
                "Dept_Name": d.Dept_Name,
                "headcount": 0,
                "total_payroll": 0.0,
                "average_salary": 0.0,
                "budget": float(d.Budget) if d.Budget else None,
                "budget_utilization_pct": 0.0 if d.Budget else None
            })

    return {
        "total_headcount": len(active_employees),
        "total_payroll": round(total_payroll, 2),
        "average_salary": avg_salary,
        "min_salary": min_salary,
        "max_salary": max_salary,
        "departments": dept_stats
    }


@router.put("/{emp_id}/salary")
@limiter.limit("10/minute")
def set_employee_salary(
    request: Request,
    emp_id: int,
    payload: SalarySet,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Set an employee's salary to an exact new value. Logs the change."""
    try:
        if payload.new_salary < 0:
            raise HTTPException(
                status_code=400, detail="new_salary cannot be negative")

        employee = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == emp_id).first()

        if employee is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        old_salary = float(employee.Salary)

        if old_salary == payload.new_salary:
            return {
                "message": "New salary matches current salary - no change made",
                "employee": employee
            }

        db.add(SalaryHistoryDB(
            Emp_ID=emp_id,
            old_salary=old_salary,
            new_salary=payload.new_salary,
            changed_by=current_user.username
        ))

        employee.Salary = payload.new_salary

        db.commit()
        db.refresh(employee)

        return {
            "message": f"Salary updated from {old_salary} to {payload.new_salary}",
            "employee": employee
        }

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.post("/{emp_id}/salary/increment")
@limiter.limit("10/minute")
def increment_employee_salary(
    request: Request,
    emp_id: int,
    payload: SalaryIncrement,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """
    Give a raise (positive amount) or a cut (negative amount) relative
    to the employee's current salary. Logs the change.
    """
    try:
        employee = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == emp_id).first()

        if employee is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        old_salary = float(employee.Salary)
        new_salary = round(old_salary + payload.amount, 2)

        if new_salary < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Resulting salary would be negative ({new_salary})"
            )

        db.add(SalaryHistoryDB(
            Emp_ID=emp_id,
            old_salary=old_salary,
            new_salary=new_salary,
            changed_by=current_user.username
        ))

        employee.Salary = new_salary

        db.commit()
        db.refresh(employee)

        direction = "raise" if payload.amount >= 0 else "cut"

        return {
            "message": f"Applied a {direction} of {abs(payload.amount)} "
            f"({old_salary} -> {new_salary})",
            "employee": employee
        }

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.get("/{emp_id}/salary-history")
def salary_history(
    emp_id: int,
    changed_by: Optional[str] = None,
    min_salary: Optional[float] = None,
    max_salary: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_manager_or_admin)
):
    """Fetch salary change logs for a specific employee with optional filtering."""
    try:
        employee = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == emp_id).first()

        if employee is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        query = db.query(SalaryHistoryDB).filter(
            SalaryHistoryDB.Emp_ID == emp_id
        )

        if changed_by and changed_by.strip():
            query = query.filter(SalaryHistoryDB.changed_by.ilike(f"%{changed_by.strip()}%"))

        if min_salary is not None:
            query = query.filter(SalaryHistoryDB.new_salary >= min_salary)

        if max_salary is not None:
            query = query.filter(SalaryHistoryDB.new_salary <= max_salary)

        history = query.order_by(SalaryHistoryDB.changed_at.desc()).all()
        return history

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")

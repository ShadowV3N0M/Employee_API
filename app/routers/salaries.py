from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    get_current_user,
    require_admin,
    require_manager_or_admin,
)
from app.config import limiter
from app.database import get_db
from app.models.department import DepartmentDB
from app.models.employee import EmployeeDB, SalaryHistoryDB
from app.models.user import UserDB
from app.schemas.employee import (
    BulkSalaryIncrement,
    SalaryCalculateRequest,
    SalaryIncrement,
    SalarySet,
)

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

        try:
            from app.services.notification_service import dispatch_notification
            dispatch_notification(
                db=db,
                title="💰 Salary Revision Applied",
                message=f"Salary adjustment committed for {len(updated)} employee(s) by {current_user.username}.",
                type="salary",
                link="/salary-calculator",
                broadcast=True,
            )
        except Exception:
            pass

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


def compute_salary_breakdown(
    annual_ctc: float,
    is_metro: bool = False,
    pf_capped: bool = True,
    regime: str = "new",
    deductions_80c: float = 150000.0,
    deductions_80d: float = 25000.0
):
    if annual_ctc < 0:
        annual_ctc = 0.0

    monthly_gross = round(annual_ctc / 12.0, 2)

    # Earnings structure
    basic_monthly = round(monthly_gross * 0.50, 2)
    hra_rate = 0.50 if is_metro else 0.40
    hra_monthly = round(basic_monthly * hra_rate, 2)
    conveyance_monthly = 1600.0 if monthly_gross >= 25000 else 0.0
    medical_monthly = 1250.0 if monthly_gross >= 25000 else 0.0

    fixed_components = basic_monthly + hra_monthly + conveyance_monthly + medical_monthly
    if fixed_components > monthly_gross:
        special_allowance_monthly = 0.0
        hra_monthly = max(0.0, monthly_gross - basic_monthly)
    else:
        special_allowance_monthly = round(monthly_gross - fixed_components, 2)

    # Statutory Deductions
    # EPF (Employee)
    if pf_capped:
        pf_wage = min(basic_monthly, 15000.0)
    else:
        pf_wage = basic_monthly
    epf_employee_monthly = round(pf_wage * 0.12, 2)

    # Professional Tax (standard ₹200/month)
    pt_monthly = 200.0 if monthly_gross >= 15000 else 0.0

    # ESI (Employee State Insurance: 0.75% if monthly gross <= 21000)
    if 0 < monthly_gross <= 21000:
        esi_monthly = round(monthly_gross * 0.0075, 2)
    else:
        esi_monthly = 0.0

    annual_gross = round(monthly_gross * 12.0, 2)
    annual_epf = round(epf_employee_monthly * 12.0, 2)
    annual_pt = round(pt_monthly * 12.0, 2)

    # Income Tax Calculation
    # 1. New Tax Regime (FY 2024-25 / 2025-26)
    new_std_deduction = 75000.0
    new_taxable_income = max(0.0, annual_gross - new_std_deduction)

    new_tax = 0.0
    if new_taxable_income <= 700000.0:
        # Full 87A rebate
        new_tax = 0.0
    else:
        rem = new_taxable_income
        if rem > 1500000:
            new_tax += (rem - 1500000) * 0.30
            rem = 1500000
        if rem > 1200000:
            new_tax += (rem - 1200000) * 0.20
            rem = 1200000
        if rem > 1000000:
            new_tax += (rem - 1000000) * 0.15
            rem = 1000000
        if rem > 700000:
            new_tax += (rem - 700000) * 0.10
            rem = 700000
        if rem > 300000:
            new_tax += (rem - 300000) * 0.05

        # 4% Health & Education Cess
        new_tax += new_tax * 0.04

    new_tax = round(new_tax, 2)

    # 2. Old Tax Regime
    old_std_deduction = 50000.0
    capped_80c = min(150000.0, max(annual_epf, deductions_80c))
    capped_80d = min(50000.0, max(0.0, deductions_80d))
    old_exemptions = old_std_deduction + capped_80c + capped_80d + annual_pt
    old_taxable_income = max(0.0, annual_gross - old_exemptions)

    old_tax = 0.0
    if old_taxable_income <= 500000.0:
        # Full 87A rebate
        old_tax = 0.0
    else:
        rem = old_taxable_income
        if rem > 1000000:
            old_tax += (rem - 1000000) * 0.30
            rem = 1000000
        if rem > 500000:
            old_tax += (rem - 500000) * 0.20
            rem = 500000
        if rem > 250000:
            old_tax += (rem - 250000) * 0.05

        # 4% Cess
        old_tax += old_tax * 0.04

    old_tax = round(old_tax, 2)

    # Active regime selection
    active_tax = new_tax if regime.lower() == "new" else old_tax
    active_tds_monthly = round(active_tax / 12.0, 2)

    total_deductions_monthly = round(
        epf_employee_monthly + pt_monthly + esi_monthly + active_tds_monthly, 2
    )
    net_in_hand_monthly = round(monthly_gross - total_deductions_monthly, 2)
    net_in_hand_annual = round(net_in_hand_monthly * 12.0, 2)

    tax_diff = abs(round(old_tax - new_tax, 2))
    if new_tax < old_tax:
        recommendation = "new"
    elif old_tax < new_tax:
        recommendation = "old"
    else:
        recommendation = "same"

    return {
        "annual_ctc": annual_ctc,
        "monthly_gross": monthly_gross,
        "earnings": {
            "basic": basic_monthly,
            "hra": hra_monthly,
            "special_allowance": special_allowance_monthly,
            "conveyance": conveyance_monthly,
            "medical": medical_monthly,
            "total_earnings": monthly_gross,
        },
        "deductions": {
            "epf": epf_employee_monthly,
            "professional_tax": pt_monthly,
            "esi": esi_monthly,
            "tds": active_tds_monthly,
            "total_deductions": total_deductions_monthly,
        },
        "net_salary": {
            "monthly": net_in_hand_monthly,
            "annual": net_in_hand_annual,
        },
        "tax_comparison": {
            "regime_selected": regime.lower(),
            "new_regime_tax": new_tax,
            "old_regime_tax": old_tax,
            "recommended": recommendation,
            "tax_savings": tax_diff,
        }
    }


@router.post("/salary/calculate")
def calculate_salary(
    payload: SalaryCalculateRequest,
    current_user: UserDB = Depends(get_current_user)
):
    """
    Available to all authenticated users (employees, managers, admins).
    Calculate monthly take-home salary, earnings breakdown, statutory deductions,
    and tax comparison between New and Old regimes.
    """
    return compute_salary_breakdown(
        annual_ctc=payload.annual_ctc,
        is_metro=payload.is_metro,
        pf_capped=payload.pf_capped,
        regime=payload.regime,
        deductions_80c=payload.deductions_80c,
        deductions_80d=payload.deductions_80d
    )


@router.get("/salary/my-profile")
def get_my_salary_profile(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Available to any authenticated user.
    Look up user's own linked employee salary record to load into the calculator.
    """
    emp = None
    if current_user.email:
        emp = db.query(EmployeeDB).filter(
            func.lower(EmployeeDB.Email) == current_user.email.strip().lower()
        ).first()

    if not emp and current_user.username:
        emp = db.query(EmployeeDB).filter(
            or_(
                func.lower(EmployeeDB.F_Name) == current_user.username.strip().lower(),
                func.lower(func.concat(EmployeeDB.F_Name, " ", EmployeeDB.L_Name)) == current_user.username.strip().lower()
            )
        ).first()

    if emp:
        return {
            "matched": True,
            "emp_id": emp.Emp_ID,
            "name": f"{emp.F_Name} {emp.L_Name}",
            "email": emp.Email,
            "salary": float(emp.Salary) if emp.Salary is not None else 0.0
        }

    return {
        "matched": False,
        "emp_id": None,
        "name": current_user.username,
        "email": current_user.email,
        "salary": None
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

"""
Official Reports & PDF Export Router.
Exposes endpoints for generating:
- Employee Payslip Vouchers (PDF)
- Filtered Employee Directory & Headcount Reports (PDF)
- Department Budget & Expense Statements (PDF)
- Salary Revision & Compensation Audit Letters (PDF)
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    get_current_user,
    require_manager_or_admin,
)
from app.config import limiter
from app.database import get_db
from app.models.department import DepartmentDB
from app.models.employee import EmployeeDB, SalaryHistoryDB
from app.models.user import UserDB
from app.routers.profile import resolve_user_employee
from app.services.pdf_service import (
    generate_department_budget_pdf,
    generate_employee_directory_pdf,
    generate_payslip_pdf,
    generate_salary_revision_letter_pdf,
)

router = APIRouter(prefix="/reports", tags=["Reports & PDF Exports"])


def _check_employee_access(emp_id: int, current_user: UserDB, db: Session) -> EmployeeDB:
    """
    Ensure the current user is authorized to access the given employee record.
    Admins and managers can access any record; standard users can only access their own.
    """
    employee = db.query(EmployeeDB).filter(EmployeeDB.Emp_ID == emp_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail=f"Employee #{emp_id} not found")

    if current_user.role in ("manager", "admin"):
        return employee

    # For standard user, ensure emp_id is linked to their account
    user_emp = resolve_user_employee(db, current_user)
    if not user_emp or user_emp.Emp_ID != emp_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied: You can only generate official reports for your own profile",
        )
    return employee


# =========================================================================
# 1. Payslip Voucher PDF Endpoints
# =========================================================================

@router.get("/payslip/{emp_id}/pdf")
@limiter.limit("20/minute")
def get_payslip_pdf(
    request: Request,
    emp_id: int,
    month: Optional[str] = Query(None, description="Month name (e.g. October)"),
    year: Optional[int] = Query(None, description="Calendar year (e.g. 2026)"),
    regime: str = Query("new", description="Tax regime: 'new' or 'old'"),
    is_metro: bool = Query(False, description="Metro city HRA calculation"),
    inline: bool = Query(True, description="Open inline or trigger download"),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Generate an official, printable monthly salary slip voucher PDF.
    - Managers/Admins can download for any employee.
    - Regular users can download their own payslip.
    """
    emp = _check_employee_access(emp_id, current_user, db)

    # Defaults
    now = datetime.now()
    target_month = month.strip().title() if month and month.strip() else now.strftime("%B")
    target_year = year if (year and 2000 <= year <= 2100) else now.year

    dept = db.query(DepartmentDB).filter(DepartmentDB.Dept_ID == emp.Dept_ID).first()
    dept_name = dept.Dept_Name if dept else f"Dept #{emp.Dept_ID}"

    pdf_bytes = generate_payslip_pdf(
        emp=emp,
        dept_name=dept_name,
        month=target_month,
        year=target_year,
        regime=regime.lower(),
        is_metro=is_metro,
    )

    filename = f"Payslip_{emp.Emp_ID}_{emp.F_Name}_{target_month}_{target_year}.pdf"
    disposition = "inline" if inline else "attachment"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


@router.get("/my-payslip/pdf")
@limiter.limit("20/minute")
def get_my_payslip_pdf(
    request: Request,
    month: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    regime: str = Query("new"),
    is_metro: bool = Query(False),
    inline: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Convenience self-service endpoint: Logged-in employee downloads their own payslip PDF."""
    emp = resolve_user_employee(db, current_user)
    if not emp:
        raise HTTPException(
            status_code=404,
            detail=f"No employee record is linked to user account '{current_user.username}'",
        )
    return get_payslip_pdf(
        request=request,
        emp_id=emp.Emp_ID,
        month=month,
        year=year,
        regime=regime,
        is_metro=is_metro,
        inline=inline,
        db=db,
        current_user=current_user,
    )


# =========================================================================
# 2. Employee Directory & Headcount Report PDF Endpoint
# =========================================================================

@router.get("/employees/pdf")
@limiter.limit("15/minute")
def get_employee_directory_pdf(
    request: Request,
    dept_id: Optional[int] = Query(None, description="Filter by department ID"),
    status: Optional[str] = Query("all", description="'active', 'inactive', or 'all'"),
    search: Optional[str] = Query(None, description="Search keyword"),
    inline: bool = Query(True, description="Open inline or trigger download"),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Generate an executive, printable employee directory report (Landscape A4).
    Managers and admins view compensation columns; regular users see directory fields only.
    """
    is_privileged = current_user.role in ("manager", "admin")

    query = (
        db.query(EmployeeDB, DepartmentDB.Dept_Name)
        .outerjoin(DepartmentDB, EmployeeDB.Dept_ID == DepartmentDB.Dept_ID)
    )

    # Status filter
    if status == "active":
        query = query.filter(EmployeeDB.is_active == True)  # noqa: E712
    elif status == "inactive":
        if not is_privileged:
            raise HTTPException(status_code=403, detail="Standard users cannot view inactive employees")
        query = query.filter(EmployeeDB.is_active == False)  # noqa: E712
    else:
        if not is_privileged:
            query = query.filter(EmployeeDB.is_active == True)  # noqa: E712

    # Department filter
    dept_name_filter = None
    if dept_id is not None:
        query = query.filter(EmployeeDB.Dept_ID == dept_id)
        d_rec = db.query(DepartmentDB).filter(DepartmentDB.Dept_ID == dept_id).first()
        if d_rec:
            dept_name_filter = d_rec.Dept_Name

    # Search keyword
    if search and search.strip():
        s = search.strip()
        search_conds = [
            EmployeeDB.F_Name.ilike(f"%{s}%"),
            EmployeeDB.L_Name.ilike(f"%{s}%"),
            func.concat(EmployeeDB.F_Name, " ", EmployeeDB.L_Name).ilike(f"%{s}%"),
            EmployeeDB.Email.ilike(f"%{s}%"),
        ]
        if s.isdigit():
            search_conds.append(EmployeeDB.Emp_ID == int(s))
        query = query.filter(or_(*search_conds))

    query = query.order_by(EmployeeDB.Emp_ID.asc())
    records = query.all()

    formatted_records = [(emp, dept_name or f"#{emp.Dept_ID}") for emp, dept_name in records]

    filter_info = {
        "dept": dept_name_filter,
        "status": status,
        "search": search.strip() if search else None,
    }

    pdf_bytes = generate_employee_directory_pdf(
        employees=formatted_records,
        filter_info=filter_info,
        is_privileged=is_privileged,
        generated_by=f"{current_user.username} ({current_user.role.title()})",
    )

    filename = f"Employee_Directory_{datetime.now().strftime('%Y%m%d')}.pdf"
    disposition = "inline" if inline else "attachment"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


# =========================================================================
# 3. Department Budget & Headcount Analysis PDF Endpoint
# =========================================================================

@router.get("/departments/pdf")
@limiter.limit("15/minute")
def get_department_budget_pdf(
    request: Request,
    inline: bool = Query(True, description="Open inline or trigger download"),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_manager_or_admin),
):
    """
    Manager/Admin only. Generates an executive department-level budget utilization
    and headcount cost breakdown report.
    """
    active_employees = db.query(EmployeeDB).filter(EmployeeDB.is_active == True).all()  # noqa: E712
    depts = db.query(DepartmentDB).order_by(DepartmentDB.Dept_ID.asc()).all()

    dept_stats = []
    for d in depts:
        d_emps = [e for e in active_employees if e.Dept_ID == d.Dept_ID]
        d_salaries = [float(e.Salary) for e in d_emps]
        d_total = sum(d_salaries)
        b = float(d.Budget) if d.Budget else 0.0
        util = round((d_total / b) * 100, 2) if b > 0 else None

        dept_stats.append({
            "Dept_ID": d.Dept_ID,
            "Dept_Name": d.Dept_Name,
            "headcount": len(d_emps),
            "total_payroll": round(d_total, 2),
            "average_salary": round(d_total / len(d_emps), 2) if d_emps else 0.0,
            "budget": b if b > 0 else None,
            "budget_utilization_pct": util,
        })

    all_salaries = [float(e.Salary) for e in active_employees]
    overall_summary = {
        "total_headcount": len(active_employees),
        "total_payroll": sum(all_salaries),
        "average_salary": round(sum(all_salaries) / len(all_salaries), 2) if all_salaries else 0.0,
    }

    pdf_bytes = generate_department_budget_pdf(
        dept_stats=dept_stats,
        overall_summary=overall_summary,
        generated_by=f"{current_user.username} ({current_user.role.title()})",
    )

    filename = f"Department_Budget_Statement_{datetime.now().strftime('%Y%m%d')}.pdf"
    disposition = "inline" if inline else "attachment"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


# =========================================================================
# 4. Salary Revision & Increment Letter PDF Endpoints
# =========================================================================

@router.get("/salary-revisions/{emp_id}/pdf")
@limiter.limit("20/minute")
def get_salary_revision_letter_pdf(
    request: Request,
    emp_id: int,
    inline: bool = Query(True, description="Open inline or trigger download"),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Generate an official salary revision notice & compensation audit statement PDF.
    - Managers/Admins can generate for any employee.
    - Regular employees can download their own revision letter.
    """
    emp = _check_employee_access(emp_id, current_user, db)

    dept = db.query(DepartmentDB).filter(DepartmentDB.Dept_ID == emp.Dept_ID).first()
    dept_name = dept.Dept_Name if dept else f"Dept #{emp.Dept_ID}"

    history = (
        db.query(SalaryHistoryDB)
        .filter(SalaryHistoryDB.Emp_ID == emp.Emp_ID)
        .order_by(SalaryHistoryDB.changed_at.desc())
        .all()
    )

    pdf_bytes = generate_salary_revision_letter_pdf(
        emp=emp,
        dept_name=dept_name,
        history=history,
        generated_by=f"{current_user.username} ({current_user.role.title()})",
    )

    filename = f"Salary_Revision_Letter_{emp.Emp_ID}_{emp.F_Name}.pdf"
    disposition = "inline" if inline else "attachment"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


@router.get("/my-salary-revision/pdf")
@limiter.limit("20/minute")
def get_my_salary_revision_letter_pdf(
    request: Request,
    inline: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Convenience self-service endpoint: Logged-in employee downloads their own salary revision letter PDF."""
    emp = resolve_user_employee(db, current_user)
    if not emp:
        raise HTTPException(
            status_code=404,
            detail=f"No employee record is linked to user account '{current_user.username}'",
        )
    return get_salary_revision_letter_pdf(
        request=request,
        emp_id=emp.Emp_ID,
        inline=inline,
        db=db,
        current_user=current_user,
    )

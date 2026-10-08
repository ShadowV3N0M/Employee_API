"""Analytics router providing role-based workforce intelligence and payroll insights."""
from collections import Counter
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import limiter
from app.database import get_db
from app.models.department import DepartmentDB
from app.models.employee import EmergencyContactDB, EmployeeDB
from app.models.user import UserDB

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/workforce")
@limiter.limit("30/minute")
def get_workforce_analytics(
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns comprehensive employee workforce analytics and organization intelligence.
    - Role 'admin' & 'manager': Full workforce demographics + confidential compensation & department budget utilization.
    - Role 'user' (regular employee): Non-confidential workforce demographics, tenure, emergency preparedness,
      and department staffing proportions. Confidential salary and financial budget figures are strictly redacted (None).
    """
    is_privileged = current_user.role in ("admin", "manager")
    today = date.today()

    all_employees = db.query(EmployeeDB).all()
    active_employees = [e for e in all_employees if e.is_active]
    inactive_employees = [e for e in all_employees if not e.is_active]

    total_headcount = len(all_employees)
    active_headcount = len(active_employees)
    inactive_headcount = len(inactive_employees)
    retention_rate_pct = (
        round((active_headcount / total_headcount) *
              100, 1) if total_headcount > 0 else 100.0
    )

    # 1. Tenure & Hiring Velocity Calculations
    tenure_days_list = []
    new_hires_30 = 0
    new_hires_90 = 0
    new_hires_365 = 0

    tenure_brackets = {
        "under_1_year": 0,
        "1_to_3_years": 0,
        "3_to_5_years": 0,
        "over_5_years": 0,
    }

    for emp in active_employees:
        j_date: date
        if emp.joining_date:
            j_date = emp.joining_date
        elif emp.created_at:
            j_date = emp.created_at.date()
        else:
            j_date = today

        days_employed = max(0, (today - j_date).days)
        tenure_days_list.append(days_employed)

        # Velocity counts
        if days_employed <= 30:
            new_hires_30 += 1
        if days_employed <= 90:
            new_hires_90 += 1
        if days_employed <= 365:
            new_hires_365 += 1

        # Tenure band buckets
        years_employed = days_employed / 365.25
        if years_employed < 1.0:
            tenure_brackets["under_1_year"] += 1
        elif years_employed < 3.0:
            tenure_brackets["1_to_3_years"] += 1
        elif years_employed < 5.0:
            tenure_brackets["3_to_5_years"] += 1
        elif years_employed >= 5.0:
            tenure_brackets["over_5_years"] += 1
        else:
            # Should not occur, but safeguard
            pass

    avg_tenure_years = (
        round((sum(tenure_days_list) / len(tenure_days_list)) / 365.25, 1)
        if tenure_days_list
        else 0.0
    )

    # 2. Emergency Contact (SOS) Readiness
    contact_emp_ids = set(
        r[0] for r in db.query(EmergencyContactDB.emp_id).distinct().all()
    )
    active_with_emergency_contacts = sum(
        1 for e in active_employees if e.Emp_ID in contact_emp_ids
    )
    sos_coverage_pct = (
        round((active_with_emergency_contacts / active_headcount) * 100, 1)
        if active_headcount > 0
        else 0.0
    )

    # 3. Blood Group Distribution (Workforce Emergency Directory)
    blood_group_counts = Counter(
        (e.blood_group.strip().upper()
         if e.blood_group and e.blood_group.strip() else "Not Specified")
        for e in active_employees
    )
    # Canonical order for display
    canonical_bg = ["O+", "A+", "B+", "AB+",
                    "O-", "A-", "B-", "AB-", "Not Specified"]
    blood_group_distribution = {}
    for bg in canonical_bg:
        if blood_group_counts.get(bg, 0) > 0:
            blood_group_distribution[bg] = blood_group_counts[bg]
    # Add any remaining unusual groups
    for bg, count in blood_group_counts.items():
        if bg not in blood_group_distribution and count > 0:
            blood_group_distribution[bg] = count

    # 4. Age Demographics (dob) - Manager/Admin only
    age_demographics = None
    if is_privileged:
        age_brackets = {
            "under_25": 0,
            "25_to_34": 0,
            "35_to_49": 0,
            "50_plus": 0,
            "unspecified": 0,
        }
        for emp in active_employees:
            if emp.dob:
                age = (today - emp.dob).days // 365.25
                if age < 25:
                    age_brackets["under_25"] += 1
                elif age < 35:
                    age_brackets["25_to_34"] += 1
                elif age < 50:
                    age_brackets["35_to_49"] += 1
                else:
                    age_brackets["50_plus"] += 1
            else:
                age_brackets["unspecified"] += 1
        age_demographics = age_brackets

    # 5. Department Breakdown
    departments = db.query(DepartmentDB).order_by(
        DepartmentDB.Dept_ID.asc()).all()
    dept_stats = []
    all_salaries: List[float] = []

    for d in departments:
        dept_emps = [e for e in active_employees if e.Dept_ID == d.Dept_ID]
        headcount = len(dept_emps)
        headcount_pct = (
            round((headcount / active_headcount) * 100, 1)
            if active_headcount > 0
            else 0.0
        )

        dept_entry: Dict[str, Any] = {
            "dept_id": d.Dept_ID,
            "dept_name": d.Dept_Name,
            "headcount": headcount,
            "percentage_of_total": headcount_pct,
            # Confidential fields: None by default
            "total_payroll": None,
            "average_salary": None,
            "budget": None,
            "budget_utilization_pct": None,
            "budget_status": None,
        }

        if is_privileged:
            d_salaries = [float(e.Salary)
                          for e in dept_emps if e.Salary is not None]
            all_salaries.extend(d_salaries)
            d_total = sum(d_salaries)
            budget_val = float(d.Budget) if d.Budget is not None else None
            util_pct = (
                round((d_total / budget_val) * 100, 1)
                if budget_val and budget_val > 0
                else None
            )

            status = "unbudgeted"
            if util_pct is not None:
                if util_pct > 100.0:
                    status = "over"
                elif util_pct >= 80.0:
                    status = "warning"
                else:
                    status = "safe"

            dept_entry["total_payroll"] = round(d_total, 2)
            dept_entry["average_salary"] = (
                round(d_total / len(d_salaries), 2) if d_salaries else 0.0
            )
            dept_entry["budget"] = budget_val
            dept_entry["budget_utilization_pct"] = util_pct
            dept_entry["budget_status"] = status

        dept_stats.append(dept_entry)

    # 6. Organization Financials (Admin/Manager only)
    financials = None
    if is_privileged:
        total_p = sum(all_salaries) if all_salaries else 0.0
        financials = {
            "total_payroll": round(total_p, 2),
            "average_salary": round(total_p / len(all_salaries), 2) if all_salaries else 0.0,
            "min_salary": min(all_salaries) if all_salaries else 0.0,
            "max_salary": max(all_salaries) if all_salaries else 0.0,
            "active_payroll_count": len(all_salaries),
        }

    return {
        "summary": {
            "total_headcount": total_headcount,
            "active_headcount": active_headcount,
            "inactive_headcount": inactive_headcount,
            "retention_rate_pct": retention_rate_pct,
            "avg_tenure_years": avg_tenure_years,
            "new_hires_last_30_days": new_hires_30,
            "new_hires_last_90_days": new_hires_90,
            "new_hires_last_365_days": new_hires_365,
            "emergency_contacts_coverage_pct": sos_coverage_pct,
            "departments_count": len(departments),
        },
        "tenure_brackets": tenure_brackets,
        "blood_group_distribution": blood_group_distribution,
        "age_demographics": age_demographics,
        "departments": dept_stats,
        "financials": financials,
        "viewer_role": current_user.role,
        "is_financial_masked": not is_privileged,
    }

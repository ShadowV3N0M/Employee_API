"""Employee presentation and query helpers."""
from app.models.employee import EmployeeDB

SORTABLE_FIELDS = {
    "Emp_ID": EmployeeDB.Emp_ID,
    "F_Name": EmployeeDB.F_Name,
    "Salary": EmployeeDB.Salary,
    "Dept_ID": EmployeeDB.Dept_ID,
}


def employee_view(emp: EmployeeDB, role: str) -> dict:
    """
    Format employee data based on user role permissions:
    - user: directory info only (Name, Email, Dept, Active status, Joining Date).
    - manager/admin: full record including salary, address, timestamps, and joining date.
    """
    j_date = None
    if getattr(emp, "joining_date", None):
        j_date = str(emp.joining_date)
    elif emp.created_at:
        j_date = emp.created_at.date().isoformat()

    view = {
        "Emp_ID": emp.Emp_ID,
        "F_Name": emp.F_Name,
        "L_Name": emp.L_Name,
        "Dept_ID": emp.Dept_ID,
        "Email": emp.Email,
        "is_active": emp.is_active,
        "joining_date": j_date,
    }

    if role in ("manager", "admin"):
        view["Salary"] = float(emp.Salary) if emp.Salary is not None else 0.0
        view["Address"] = emp.Address
        view["created_at"] = emp.created_at
        view["updated_at"] = emp.updated_at

    return view

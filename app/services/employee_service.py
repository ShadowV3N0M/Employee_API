"""Employee presentation and query helpers."""
from app.models.employee import EmployeeDB

SORTABLE_FIELDS = {
    "Emp_ID": EmployeeDB.Emp_ID,
    "F_Name": EmployeeDB.F_Name,
    "L_Name": EmployeeDB.L_Name,
    "Salary": EmployeeDB.Salary,
    "Dept_ID": EmployeeDB.Dept_ID,
    "Email": EmployeeDB.Email,
    "joining_date": EmployeeDB.joining_date,
    "is_active": EmployeeDB.is_active,
    "created_at": EmployeeDB.created_at,
}


def employee_view(emp: EmployeeDB, role: str) -> dict:
    """
    Format employee data based on user role permissions:
    - user: directory info only (Name, Email, Dept, Active status, Joining Date, Personal Phone).
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
        "personal_phone": emp.personal_phone,
        "is_active": emp.is_active,
        "joining_date": j_date,
    }

    if role in ("manager", "admin"):
        view["Salary"] = float(emp.Salary) if emp.Salary is not None else 0.0
        view["Address"] = emp.Address
        view["created_at"] = emp.created_at
        view["updated_at"] = emp.updated_at
        view["blood_group"] = emp.blood_group
        view["dob"] = str(emp.dob) if getattr(emp, "dob", None) else None
        view["marital_status"] = emp.marital_status

    return view


def shift_employees_upward(db, target_id: int) -> int:
    """
    Shifts all employee IDs >= target_id upward by +1 (along with salary history,
    emergency contacts, and linked user accounts), executed in descending order
    to prevent key collisions. Returns the number of employees shifted.
    """
    from sqlalchemy import text

    dialect_name = db.bind.dialect.name if db.bind else "sqlite"

    count = db.execute(
        text("SELECT COUNT(*) FROM employee WHERE Emp_ID >= :target_id"),
        {"target_id": target_id}
    ).scalar() or 0

    if count == 0:
        return 0

    if dialect_name == "mysql":
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        db.execute(
            text("UPDATE salary_history SET Emp_ID = Emp_ID + 1 WHERE Emp_ID >= :target_id ORDER BY Emp_ID DESC"),
            {"target_id": target_id}
        )
        try:
            db.execute(
                text("UPDATE employee_emergency_contact SET emp_id = emp_id + 1 WHERE emp_id >= :target_id ORDER BY emp_id DESC"),
                {"target_id": target_id}
            )
        except Exception:
            pass
        try:
            db.execute(
                text("UPDATE user SET emp_id = emp_id + 1 WHERE emp_id >= :target_id ORDER BY emp_id DESC"),
                {"target_id": target_id}
            )
        except Exception:
            pass
        db.execute(
            text("UPDATE employee SET Emp_ID = Emp_ID + 1 WHERE Emp_ID >= :target_id ORDER BY Emp_ID DESC"),
            {"target_id": target_id}
        )
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    else:
        if dialect_name == "sqlite":
            db.execute(text("PRAGMA foreign_keys = OFF"))

        higher_ids = [r[0] for r in db.execute(
            text("SELECT Emp_ID FROM employee WHERE Emp_ID >= :target_id ORDER BY Emp_ID DESC"),
            {"target_id": target_id}
        ).fetchall()]

        for old_id in higher_ids:
            new_id = old_id + 1
            db.execute(
                text("UPDATE salary_history SET Emp_ID = :new_id WHERE Emp_ID = :old_id"),
                {"new_id": new_id, "old_id": old_id}
            )
            try:
                db.execute(
                    text("UPDATE employee_emergency_contact SET emp_id = :new_id WHERE emp_id = :old_id"),
                    {"new_id": new_id, "old_id": old_id}
                )
            except Exception:
                pass
            try:
                db.execute(
                    text("UPDATE user SET emp_id = :new_id WHERE emp_id = :old_id"),
                    {"new_id": new_id, "old_id": old_id}
                )
            except Exception:
                pass
            db.execute(
                text("UPDATE employee SET Emp_ID = :new_id WHERE Emp_ID = :old_id"),
                {"new_id": new_id, "old_id": old_id}
            )

        if dialect_name == "sqlite":
            db.execute(text("PRAGMA foreign_keys = ON"))

    db.flush()
    db.expire_all()
    return count


def resequence_employees_consecutively(db, min_affected_id: int) -> int:
    """
    Resequences all employees >= min_affected_id so that their IDs become consecutive
    without any gaps. Updates salary history, emergency contacts, and linked users.
    Executes in ascending order so new_id < old_id never collides.
    """
    from sqlalchemy import text

    dialect_name = db.bind.dialect.name if db.bind else "sqlite"

    rows = db.execute(
        text("SELECT Emp_ID FROM employee WHERE Emp_ID >= :min_id ORDER BY Emp_ID ASC"),
        {"min_id": min_affected_id}
    ).fetchall()

    if not rows:
        return 0

    if dialect_name == "mysql":
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    elif dialect_name == "sqlite":
        db.execute(text("PRAGMA foreign_keys = OFF"))

    expected_id = min_affected_id
    resequenced_count = 0
    for r in rows:
        curr_id = r[0]
        if curr_id != expected_id:
            db.execute(
                text("UPDATE salary_history SET Emp_ID = :new_id WHERE Emp_ID = :old_id"),
                {"new_id": expected_id, "old_id": curr_id}
            )
            try:
                db.execute(
                    text("UPDATE employee_emergency_contact SET emp_id = :new_id WHERE emp_id = :old_id"),
                    {"new_id": expected_id, "old_id": curr_id}
                )
            except Exception:
                pass
            try:
                db.execute(
                    text("UPDATE user SET emp_id = :new_id WHERE emp_id = :old_id"),
                    {"new_id": expected_id, "old_id": curr_id}
                )
            except Exception:
                pass
            db.execute(
                text("UPDATE employee SET Emp_ID = :new_id WHERE Emp_ID = :old_id"),
                {"new_id": expected_id, "old_id": curr_id}
            )
            resequenced_count += 1
        expected_id += 1

    if dialect_name == "mysql":
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    elif dialect_name == "sqlite":
        db.execute(text("PRAGMA foreign_keys = ON"))

    db.flush()
    db.expire_all()
    return resequenced_count

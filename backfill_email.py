"""
One-time backfill: generates sagar.p@laesfera.co style emails for
every existing employee that doesn't have one yet.

Run once after adding the Email column:
    python backfill_emails.py
"""

from EMP_main import SessionLocal, EmployeeDB, generate_employee_email

db = SessionLocal()

try:
    employees = db.query(EmployeeDB).filter(
        (EmployeeDB.Email == None) | (EmployeeDB.Email == "")  # noqa: E711
    ).order_by(EmployeeDB.Emp_ID).all()

    print(f"Found {len(employees)} employee(s) without an email.\n")

    for emp in employees:
        email = generate_employee_email(db, emp.F_Name, emp.L_Name)
        emp.Email = email
        db.flush()  # so the next collision check in this loop sees it
        print(f"  Emp_ID {emp.Emp_ID}: {emp.F_Name} {emp.L_Name} -> {email}")

    db.commit()
    print("\nBackfill complete.")

except Exception as e:
    db.rollback()
    print(f"Backfill failed, rolled back: {e}")

finally:
    db.close()

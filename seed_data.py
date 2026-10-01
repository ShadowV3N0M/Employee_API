"""
Database Reset & Seed Script for Employee Management API.

Clears existing records and populates clean initial data with valid hashed passwords.

Usage:
    python seed_data.py
or
    ..\\venv\\Scripts\\python.exe seed_data.py
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from EMP_main import (
    Base, engine, SessionLocal,
    DepartmentDB, EmployeeDB, SalaryHistoryDB, UserDB, PasswordResetTokenDB,
    hash_password, generate_employee_email
)



def reset_and_seed():
    print("=" * 65)
    print(" Resetting and Seeding Database (userdb)...")
    print("=" * 65)

    # 1. Ensure all tables exist with current schema
    Base.metadata.create_all(bind=engine)

    # 2. Clear existing records safely in order of foreign keys
    print("\n[1/4] Clearing existing data...")
    with engine.connect() as conn:
        try:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
            conn.execute(text("TRUNCATE TABLE password_reset_token;"))
            conn.execute(text("TRUNCATE TABLE salary_history;"))
            conn.execute(text("TRUNCATE TABLE employee;"))
            conn.execute(text("TRUNCATE TABLE department;"))
            conn.execute(text("TRUNCATE TABLE user;"))
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            conn.commit()
            print("   -> Existing tables truncated successfully.")
        except Exception as e:
            # Fallback for SQLite or systems where TRUNCATE is restricted
            print(f"   -> Truncate note: {e}, falling back to DELETE...")
            try:
                conn.execute(text("DELETE FROM password_reset_token;"))
                conn.execute(text("DELETE FROM salary_history;"))
                conn.execute(text("DELETE FROM employee;"))
                conn.execute(text("DELETE FROM department;"))
                conn.execute(text("DELETE FROM user;"))
                conn.commit()
            except Exception as del_err:
                print(f"   -> Delete note: {del_err}")

    db = SessionLocal()
    try:
        # 3. Create Users with known passwords
        print("\n[2/4] Seeding users with hashed passwords...")
        users = [
            UserDB(
                username="admin",
                email="admin@laesfera.co",
                hashed_password=hash_password("Admin@123"),
                role="admin",
                is_active=True
            ),
            UserDB(
                username="manager",
                email="manager@laesfera.co",
                hashed_password=hash_password("Manager@123"),
                role="manager",
                is_active=True
            ),
            UserDB(
                username="user",
                email="user@laesfera.co",
                hashed_password=hash_password("User@123"),
                role="user",
                is_active=True
            ),
            UserDB(
                username="sagar",
                email="sagar.p@laesfera.co",
                hashed_password=hash_password("Root@1234"),
                role="admin",
                is_active=True
            ),
        ]
        db.add_all(users)
        db.commit()
        print(f"   -> Inserted {len(users)} users.")

        # 4. Create Departments
        print("\n[3/4] Seeding departments...")
        depts = [
            DepartmentDB(Dept_Name="Engineering", Budget=650000.00),
            DepartmentDB(Dept_Name="Human Resources", Budget=180000.00),
            DepartmentDB(Dept_Name="Finance", Budget=320000.00),
            DepartmentDB(Dept_Name="Marketing", Budget=250000.00),
            DepartmentDB(Dept_Name="Sales", Budget=400000.00),
            DepartmentDB(Dept_Name="Customer Support", Budget=150000.00),
            DepartmentDB(Dept_Name="Research & Development", Budget=500000.00),
            DepartmentDB(Dept_Name="IT Services", Budget=220000.00),
            DepartmentDB(Dept_Name="Legal", Budget=120000.00),
            DepartmentDB(Dept_Name="Operations", Budget=300000.00),
            DepartmentDB(Dept_Name="Product Management", Budget=280000.00),
            DepartmentDB(Dept_Name="Quality Assurance", Budget=200000.00),
            DepartmentDB(Dept_Name="Business Development", Budget=350000.00),
            DepartmentDB(Dept_Name="Public Relations", Budget=170000.00),
            DepartmentDB(Dept_Name="Logistics", Budget=190000.00),
            DepartmentDB(Dept_Name="Procurement", Budget=210000.00),
            DepartmentDB(Dept_Name="Training & Development", Budget=160000.00),
            DepartmentDB(Dept_Name="Compliance", Budget=140000.00),
            DepartmentDB(Dept_Name="Facilities Management", Budget=130000.00),
            DepartmentDB(Dept_Name="Strategy & Planning", Budget=240000.00),
            DepartmentDB(Dept_Name="AI & Machine Learning", Budget=450000.00),
            DepartmentDB(Dept_Name="Data Analytics", Budget=300000.00),
            DepartmentDB(Dept_Name="Cybersecurity", Budget=280000.00),
            DepartmentDB(Dept_Name="Cloud Services", Budget=321111.11),
            DepartmentDB(Dept_Name="Mobile Development", Budget=271111.11),
        ]
        db.add_all(depts)
        db.commit()
        for d in depts:
            db.refresh(d)
        print(f"   -> Inserted {len(depts)} departments.")

        # 5. Create Employees
        print("\n[4/4] Seeding employees...")
        employees_data = [
            {"Emp_ID": 101, "F_Name": "Sagar", "L_Name": "Pokhariyal", "Salary": 95000.00,
                "Dept_ID": depts[0].Dept_ID, "Address": "101 Tech Boulevard"},
            {"Emp_ID": 102, "F_Name": "Aarav", "L_Name": "Sharma", "Salary": 82000.00,
                "Dept_ID": depts[0].Dept_ID, "Address": "204 Silicon Valley Rd"},
            {"Emp_ID": 103, "F_Name": "Priya", "L_Name": "Patel", "Salary": 75000.00,
                "Dept_ID": depts[1].Dept_ID, "Address": "12 Corporate Way"},
            {"Emp_ID": 104, "F_Name": "Rohit", "L_Name": "Verma", "Salary": 68000.00,
                "Dept_ID": depts[2].Dept_ID, "Address": "88 Finance Plaza"},
            {"Emp_ID": 105, "F_Name": "Ananya", "L_Name": "Iyer", "Salary": 62000.00,
                "Dept_ID": depts[3].Dept_ID, "Address": "45 Market Street"},
        ]

        for emp in employees_data:
            new_emp = EmployeeDB(**emp)
            new_emp.Email = generate_employee_email(
                db, emp["F_Name"], emp["L_Name"])
            db.add(new_emp)
        db.commit()
        print(f"   -> Inserted {len(employees_data)} employees.")

        print("\n" + "=" * 65)
        print(" DATABASE RESET & SEED COMPLETE!")
        print("=" * 65)
        print("\nReady-to-use Login Credentials:")
        print("+" + "-" * 14 + "+" + "-" * 16 +
              "+" + "-" * 11 + "+" + "-" * 24 + "+")
        print("| Username     | Password       | Role      | Email                  |")
        print("+" + "-" * 14 + "+" + "-" * 16 +
              "+" + "-" * 11 + "+" + "-" * 24 + "+")
        print("| admin        | Admin@123      | admin     | admin@laesfera.co      |")
        print("| manager      | Manager@123    | manager   | manager@laesfera.co    |")
        print("| user         | User@123       | user      | user@laesfera.co       |")
        print("| sagar        | Root@1234      | admin     | sagar.p@laesfera.co    |")
        print("+" + "-" * 14 + "+" + "-" * 16 +
              "+" + "-" * 11 + "+" + "-" * 24 + "+")
        print("\nYou can now sign in at http://localhost:5173 or Swagger UI.")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Seeding failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    reset_and_seed()

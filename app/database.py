"""Database connection setup, resilient fallback, and session management."""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DATABASE_URL

Base = declarative_base()


def _create_resilient_engine():
    """
    Creates SQLAlchemy engine with automatic local SQLite fallback
    if the configured MySQL server is unreachable.
    """
    target_url = DATABASE_URL
    connect_args = {}

    if target_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        return create_engine(target_url, connect_args=connect_args)

    if "mysql" in target_url:
        connect_args["connect_timeout"] = 3
        try:
            eng = create_engine(target_url, connect_args=connect_args)
            # Test connection with short timeout
            with eng.connect() as conn:
                pass
            return eng
        except Exception as exc:
            server_host = target_url.split("@")[-1] if "@" in target_url else target_url
            print(f"[DATABASE] MySQL server on {server_host} is not reachable ({exc}).")
            print("[DATABASE] Gracefully falling back to local SQLite database: sqlite:///./userdb.db")
            sqlite_url = "sqlite:///./userdb.db"
            return create_engine(sqlite_url, connect_args={"check_same_thread": False})

    return create_engine(target_url, connect_args=connect_args)


engine = _create_resilient_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency that yields a database session for requests."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def auto_migrate_schema():
    """Ensure newly introduced columns exist in legacy databases."""
    try:
        with engine.connect() as conn:
            dialect = engine.dialect.name
            if dialect == "mysql":
                try:
                    has_email = conn.execute(text(
                        "SELECT 1 FROM information_schema.columns "
                        "WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'email'"
                    )).fetchone()
                    if not has_email:
                        conn.execute(
                            text("ALTER TABLE `user` ADD COLUMN `email` VARCHAR(100) UNIQUE NULL"))
                        conn.commit()

                    has_joining_date = conn.execute(text(
                        "SELECT 1 FROM information_schema.columns "
                        "WHERE table_schema = DATABASE() AND table_name = 'employee' AND column_name = 'joining_date'"
                    )).fetchone()
                    if not has_joining_date:
                        conn.execute(
                            text("ALTER TABLE `employee` ADD COLUMN `joining_date` DATE NULL"))
                        try:
                            conn.execute(
                                text("UPDATE `employee` SET `joining_date` = DATE(`created_at`) WHERE `joining_date` IS NULL AND `created_at` IS NOT NULL"))
                        except Exception:
                            pass
                        conn.commit()

                    # Extended self-service profile columns
                    cols_to_add = [
                        ("user", "emp_id", "INT NULL"),
                        ("employee", "personal_phone", "VARCHAR(20) NULL"),
                        ("employee", "blood_group", "VARCHAR(10) NULL"),
                        ("employee", "dob", "DATE NULL"),
                        ("employee", "marital_status", "VARCHAR(20) NULL"),
                    ]
                    for tbl, col, col_def in cols_to_add:
                        has_col = conn.execute(text(
                            f"SELECT 1 FROM information_schema.columns "
                            f"WHERE table_schema = DATABASE() AND table_name = '{tbl}' AND column_name = '{col}'"
                        )).fetchone()
                        if not has_col:
                            conn.execute(text(f"ALTER TABLE `{tbl}` ADD COLUMN `{col}` {col_def}"))
                            conn.commit()
                except Exception as my_err:
                    print(f"[WARN] MySQL auto-migration check: {my_err}")
            else:
                # SQLite / fallback check
                try:
                    conn.execute(text("ALTER TABLE user ADD COLUMN email VARCHAR(100)"))
                    conn.commit()
                except Exception:
                    pass
                try:
                    conn.execute(text("ALTER TABLE user ADD COLUMN emp_id INTEGER"))
                    conn.commit()
                except Exception:
                    pass
                try:
                    conn.execute(text("ALTER TABLE employee ADD COLUMN joining_date DATE"))
                    try:
                        conn.execute(
                            text("UPDATE employee SET joining_date = DATE(created_at) WHERE joining_date IS NULL AND created_at IS NOT NULL"))
                    except Exception:
                        pass
                    conn.commit()
                except Exception:
                    pass
                for col, col_def in [
                    ("personal_phone", "VARCHAR(20)"),
                    ("blood_group", "VARCHAR(10)"),
                    ("dob", "DATE"),
                    ("marital_status", "VARCHAR(20)"),
                ]:
                    try:
                        conn.execute(text(f"ALTER TABLE employee ADD COLUMN {col} {col_def}"))
                        conn.commit()
                    except Exception:
                        pass
    except Exception as e:
        print(f"[WARN] Schema auto-migration check: {e}")


def seed_defaults_if_empty():
    """Seed initial departments, employees, and user accounts if the database is fresh."""
    try:
        from app.models.user import UserDB
        from app.models.department import DepartmentDB
        from app.models.employee import EmployeeDB
        from app.auth.security import hash_password

        with SessionLocal() as db:
            user_count = db.query(UserDB).count()
            if user_count == 0:
                print("[DATABASE] Fresh database detected. Seeding initial accounts and departments...")
                # Departments
                depts = [
                    DepartmentDB(Dept_ID=1, Dept_Name="Engineering", Budget=650000.00),
                    DepartmentDB(Dept_ID=2, Dept_Name="Human Resources", Budget=180000.00),
                    DepartmentDB(Dept_ID=3, Dept_Name="Finance", Budget=320000.00),
                    DepartmentDB(Dept_ID=4, Dept_Name="Marketing", Budget=250000.00),
                ]
                db.add_all(depts)
                db.flush()

                # Demo employees
                emp1 = EmployeeDB(
                    Emp_ID=101,
                    F_Name="Aarav",
                    L_Name="Sharma",
                    Salary=85000.00,
                    Dept_ID=1,
                    Address="123 Tech Park, Bangalore",
                    Email="aarav.s@laesfera.co",
                    is_active=True,
                )
                db.add(emp1)
                db.flush()

                # Users
                users = [
                    UserDB(
                        username="admin",
                        email="admin@laesfera.co",
                        hashed_password=hash_password("Admin@123"),
                        role="admin",
                        is_active=True,
                    ),
                    UserDB(
                        username="manager",
                        email="manager@laesfera.co",
                        hashed_password=hash_password("Manager@123"),
                        role="manager",
                        is_active=True,
                    ),
                    UserDB(
                        username="user",
                        email="user@laesfera.co",
                        hashed_password=hash_password("User@123"),
                        role="user",
                        is_active=True,
                    ),
                    UserDB(
                        username="sagar",
                        email="sagar.p@laesfera.co",
                        hashed_password=hash_password("Root@1234"),
                        role="admin",
                        is_active=True,
                    ),
                    UserDB(
                        username="Aarav.S",
                        email="aarav.s@laesfera.co",
                        hashed_password=hash_password("User@123"),
                        role="user",
                        emp_id=101,
                        is_active=True,
                    ),
                ]
                db.add_all(users)
                db.commit()
                print("[DATABASE] Initial seeding complete: admin, manager, user, sagar, Aarav.S ready.")
    except Exception as e:
        print(f"[WARN] Default seeding note: {e}")

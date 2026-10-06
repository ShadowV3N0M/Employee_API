"""Database connection setup and session management."""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DATABASE_URL

# Connect arguments for SQLite (tests) vs MySQL (production)
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


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
            # Check MySQL information_schema
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

            except Exception:
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

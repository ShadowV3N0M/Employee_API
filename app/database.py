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
            except Exception:
                # SQLite / fallback check
                try:
                    conn.execute(
                        text("ALTER TABLE user ADD COLUMN email VARCHAR(100)"))
                    conn.commit()
                except Exception:
                    pass
    except Exception as e:
        print(f"[WARN] Schema auto-migration check: {e}")

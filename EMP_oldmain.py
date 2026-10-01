import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy import (
    create_engine, Column, Integer, String, Numeric, Boolean,
    DateTime, ForeignKey, text, func
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded


# =========================================================
# CONFIG
# =========================================================

# In production, load these from environment variables / a secrets
# manager - never hardcode a real secret key like this.
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:Root%401234@localhost:3306/userdb"
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Employee Management API", version="2.0.1")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# =========================================================
# DATABASE SETUP
# =========================================================

engine = create_engine(DATABASE_URL)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================================================
# MODELS
# =========================================================

class DepartmentDB(Base):
    __tablename__ = "department"

    Dept_ID = Column(Integer, primary_key=True, autoincrement=True)
    Dept_Name = Column(String(50), unique=True, nullable=False)
    Budget = Column(Numeric(18, 2), nullable=True)

    employees = relationship("EmployeeDB", back_populates="department")


class EmployeeDB(Base):
    __tablename__ = "employee"

    Emp_ID = Column(Integer, primary_key=True, nullable=False)
    F_Name = Column(String(50), nullable=False)
    L_Name = Column(String(50), nullable=False)
    Salary = Column(Numeric(20, 2), nullable=False)
    Dept_ID = Column(Integer, ForeignKey("department.Dept_ID"), nullable=False)
    Address = Column(String(500), nullable=False)
    Email = Column(String(100), unique=True, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())

    department = relationship("DepartmentDB", back_populates="employees")
    salary_history = relationship("SalaryHistoryDB", back_populates="employee")


class SalaryHistoryDB(Base):
    __tablename__ = "salary_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    Emp_ID = Column(Integer, ForeignKey("employee.Emp_ID"), nullable=False)
    old_salary = Column(Numeric(20, 2), nullable=False)
    new_salary = Column(Numeric(20, 2), nullable=False)
    changed_by = Column(String(50), nullable=True)
    changed_at = Column(DateTime, server_default=func.now())

    employee = relationship("EmployeeDB", back_populates="salary_history")


class UserDB(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="user",
                  nullable=False)  # "admin" or "user"
    is_active = Column(Boolean, default=True, nullable=False)


# =========================================================
# EMAIL GENERATION
# =========================================================

EMAIL_DOMAIN = "laesfera.co"


def generate_employee_email(db: Session, f_name: str, l_name: str) -> str:
    """
    Builds sagar.p@laesfera.co style emails from first name + last initial.

    If that collides with an existing employee, extends the last-name
    portion one letter at a time (p -> pa -> pat -> ...) until unique,
    e.g. Parth Patil vs Parth Pandey becomes parth.pat vs parth.pan
    rather than parth.p vs parth.p2.

    Only if the FULL last name is still not unique (two employees with
    the exact same first + last name) does it fall back to a numeric
    suffix on the full name, e.g. parth.patil2@laesfera.co.
    """

    first = f_name.strip().lower().replace(" ", "")
    last = l_name.strip().lower().replace(" ", "")

    def email_taken(candidate: str) -> bool:
        return db.query(EmployeeDB).filter(EmployeeDB.Email == candidate).first() is not None

    if not last:
        candidate = f"{first}@{EMAIL_DOMAIN}"
        suffix = 2
        while email_taken(candidate):
            candidate = f"{first}{suffix}@{EMAIL_DOMAIN}"
            suffix += 1
        return candidate

    # Try growing prefixes of the last name: p, pa, pat, pati, patil...
    for i in range(1, len(last) + 1):
        candidate = f"{first}.{last[:i]}@{EMAIL_DOMAIN}"
        if not email_taken(candidate):
            return candidate

    # Full last name still collides (exact same first + last name already
    # exists) - fall back to numbering the full name.
    suffix = 2
    candidate = f"{first}.{last}{suffix}@{EMAIL_DOMAIN}"
    while email_taken(candidate):
        suffix += 1
        candidate = f"{first}.{last}{suffix}@{EMAIL_DOMAIN}"

    return candidate


# =========================================================
# PYDANTIC SCHEMAS
# =========================================================

class DepartmentCreate(BaseModel):
    Dept_Name: str
    Budget: Optional[float] = None


class Employee(BaseModel):
    Emp_ID: int
    F_Name: str
    L_Name: str
    Salary: float
    Dept_ID: int
    Address: str


class EmployeeUpdate(BaseModel):
    F_Name: Optional[str] = None
    L_Name: Optional[str] = None
    Salary: Optional[float] = None
    Dept_ID: Optional[int] = None
    Address: Optional[str] = None


class SalarySet(BaseModel):
    new_salary: float


class SalaryIncrement(BaseModel):
    amount: float  # positive to give a raise, negative to cut


class UserRegister(BaseModel):
    username: str
    password: str
    role: str = "user"  # demo only - lock this down / require admin approval in production


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# =========================================================
# AUTH HELPERS
# =========================================================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + \
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> UserDB:

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")

        if username is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = db.query(UserDB).filter(UserDB.username == username).first()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


def require_admin(current_user: UserDB = Depends(get_current_user)) -> UserDB:

    if current_user.role != "admin":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )

    return current_user


# =========================================================
# AUTH ENDPOINTS
# =========================================================

@app.post("/auth/register", response_model=Token)
@limiter.limit("5/minute")
def register(request: Request, user: UserRegister, db: Session = Depends(get_db)):

    try:
        existing = db.query(UserDB).filter(
            UserDB.username == user.username).first()

        if existing:
            raise HTTPException(
                status_code=409, detail="Username already taken")

        new_user = UserDB(
            username=user.username,
            hashed_password=hash_password(user.password),
            role=user.role
        )

        db.add(new_user)
        db.commit()

        token = create_access_token(
            {"sub": new_user.username, "role": new_user.role})

        return Token(access_token=token)

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@app.post("/auth/login", response_model=Token)
@limiter.limit("10/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    try:
        user = db.query(UserDB).filter(
            UserDB.username == form_data.username).first()

        if not user or not verify_password(form_data.password, user.hashed_password):

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = create_access_token({"sub": user.username, "role": user.role})

        return Token(access_token=token)

    except HTTPException:
        raise

    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
def health_check(db: Session = Depends(get_db)):

    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}

    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=503, detail=f"Database unavailable: {str(e)}")


# =========================================================
# DEPARTMENT ENDPOINTS
# =========================================================

@app.post("/departments")
@limiter.limit("10/minute")
def create_department(
    request: Request,
    dept: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):

    try:
        existing = db.query(DepartmentDB).filter(
            DepartmentDB.Dept_Name == dept.Dept_Name
        ).first()

        if existing:
            raise HTTPException(
                status_code=409, detail="Department already exists")

        new_dept = DepartmentDB(Dept_Name=dept.Dept_Name, Budget=dept.Budget)

        db.add(new_dept)
        db.commit()
        db.refresh(new_dept)

        return new_dept

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@app.get("/departments")
def list_departments(db: Session = Depends(get_db)):

    try:
        return db.query(DepartmentDB).all()

    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


# =========================================================
# EMPLOYEE ENDPOINTS (paginated, sortable, auth-protected writes)
# =========================================================

SORTABLE_FIELDS = {
    "Emp_ID": EmployeeDB.Emp_ID,
    "F_Name": EmployeeDB.F_Name,
    "Salary": EmployeeDB.Salary,
    "Dept_ID": EmployeeDB.Dept_ID,
}
# ----------------------------------------------------------------
# GET EMPLOYEES (paginated, sortable, filterable)
# ----------------------------------------------------------------


@app.get("/employees")
def get_employees(
    page: int = 1,
    limit: int = 20,
    sort_by: str = "Emp_ID",
    order: str = "asc",
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):

    try:
        if page < 1 or limit < 1 or limit > 2000:
            raise HTTPException(
                status_code=400,
                detail="page must be >= 1 and limit must be between 1 and 2000"
            )

        query = db.query(EmployeeDB)

        if not include_inactive:
            query = query.filter(EmployeeDB.is_active == True)  # noqa: E712

        sort_column = SORTABLE_FIELDS.get(sort_by, EmployeeDB.Emp_ID)
        query = query.order_by(sort_column.desc() if order ==
                               "desc" else sort_column.asc())

        total = query.count()
        items = query.offset((page - 1) * limit).limit(limit).all()

        return {
            "total": total,
            "page": page,
            "limit": limit,
            "items": items
        }

    except HTTPException:
        raise

    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")

# ---------------------------------------------------------------
# GET EMPLOYEE BY ID
# ---------------------------------------------------------------


@app.get("/employees/{emp_id}")
def get_employee(emp_id: int, db: Session = Depends(get_db)):

    try:
        employee = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == emp_id).first()

        if employee is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        return employee

    except HTTPException:
        raise

    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


# ---------------------------------------------------------------
# CREATE EMPLOYEE
# ---------------------------------------------------------------

@app.post("/employees")
@limiter.limit("10/minute")
def create_employee(
    request: Request,
    employee: Employee,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):

    try:
        existing = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == employee.Emp_ID
        ).first()

        if existing:
            raise HTTPException(
                status_code=409, detail="Employee ID already exists")

        dept = db.query(DepartmentDB).filter(
            DepartmentDB.Dept_ID == employee.Dept_ID
        ).first()

        if dept is None:
            raise HTTPException(
                status_code=400, detail="Dept_ID does not exist")

        new_employee = EmployeeDB(**employee.model_dump())
        new_employee.Email = generate_employee_email(
            db, employee.F_Name, employee.L_Name)

        db.add(new_employee)
        db.commit()
        db.refresh(new_employee)

        return {"message": "Employee created successfully", "employee": new_employee}

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")

# ---------------------------------------------------------------
# UPDATE EMPLOYEE (PUT)
# ---------------------------------------------------------------


@app.put("/employees/{emp_id}")
@limiter.limit("10/minute")
def update_employee(
    request: Request,
    emp_id: int,
    employee: Employee,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):

    try:
        existing = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == emp_id).first()

        if existing is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        if float(existing.Salary) != employee.Salary:
            db.add(SalaryHistoryDB(
                Emp_ID=emp_id,
                old_salary=existing.Salary,
                new_salary=employee.Salary,
                changed_by=current_user.username
            ))

        existing.F_Name = employee.F_Name
        existing.L_Name = employee.L_Name
        existing.Salary = employee.Salary
        existing.Dept_ID = employee.Dept_ID
        existing.Address = employee.Address

        db.commit()
        db.refresh(existing)

        return {"message": "Employee updated successfully", "employee": existing}

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")

# ---------------------------------------------------------------
# PATCH EMPLOYEE (partial update)
# ---------------------------------------------------------------


@app.patch("/employees/{emp_id}")
@limiter.limit("10/minute")
def patch_employee(
    request: Request,
    emp_id: int,
    employee: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):

    try:
        existing = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == emp_id).first()

        if existing is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        update_data = employee.model_dump(exclude_unset=True)

        if not update_data:
            raise HTTPException(
                status_code=400, detail="No fields provided to update")

        if "Salary" in update_data and float(existing.Salary) != update_data["Salary"]:
            db.add(SalaryHistoryDB(
                Emp_ID=emp_id,
                old_salary=existing.Salary,
                new_salary=update_data["Salary"],
                changed_by=current_user.username
            ))

        for field, value in update_data.items():
            setattr(existing, field, value)

        db.commit()
        db.refresh(existing)

        return {"message": "Employee partially updated successfully", "employee": existing}

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")

# ----------------------------------------------------------------
# Deactivate employee (soft delete) - sets is_active to False
# ----------------------------------------------------------------


@app.delete("/employees/{emp_id}/deactivate")
@limiter.limit("10/minute")
def deactivate_employee(
    request: Request,
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Soft delete: marks the employee inactive instead of removing the row."""

    try:
        employee = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == emp_id).first()

        if employee is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        employee.is_active = False

        db.commit()

        return {"message": "Employee deactivated successfully"}

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")

# ---------------------------------------------------------------
# Restore employee (undo soft delete) - sets is_active to True
# ---------------------------------------------------------------


@app.post("/employees/{emp_id}/restore")
@limiter.limit("10/minute")
def restore_employee(
    request: Request,
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):

    try:
        employee = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == emp_id).first()

        if employee is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        employee.is_active = True

        db.commit()

        return {"message": "Employee restored successfully"}

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")

    # =========================================================
    # DELETE EMPLOYEE
    # =========================================================


@app.delete("/employees/{emp_id}/delete")
@limiter.limit("10/minute")
def delete_employee(
    request: Request,
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)

):
    """Hard delete: deletes the employee record from the database."""

    try:
        employee = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == emp_id
        ).first()

        if employee is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        db.delete(employee)

        db.commit()

        return {
            "message": "Employee deleted successfully"
        }

    except HTTPException:

        db.rollback()

        raise

    except SQLAlchemyError as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )
# =========================================================
# DEDICATED SALARY ENDPOINTS
# =========================================================


@app.put("/employees/{emp_id}/salary")
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


@app.post("/employees/{emp_id}/salary/increment")
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


# =========================================================
# SALARY HISTORY / TREND
# =========================================================

@app.get("/employees/{emp_id}/salary-history")
def salary_history(emp_id: int, db: Session = Depends(get_db)):

    try:
        employee = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == emp_id).first()

        if employee is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        history = db.query(SalaryHistoryDB).filter(
            SalaryHistoryDB.Emp_ID == emp_id
        ).order_by(SalaryHistoryDB.changed_at).all()

        return history

    except HTTPException:
        raise

    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


# =========================================================
# STARTUP: create tables if they don't exist
# =========================================================

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

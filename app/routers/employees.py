from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    get_current_user,
    require_admin,
    require_manager_or_admin,
)
from app.config import limiter
from app.database import get_db
from app.models.department import DepartmentDB
from app.models.employee import EmployeeDB, SalaryHistoryDB
from app.models.user import UserDB
from app.schemas.employee import BulkEmployeeDelete, Employee, EmployeeUpdate
from app.services.email_service import generate_employee_email
from app.services.employee_service import employee_view, SORTABLE_FIELDS
from app.services.excel_service import (
    export_employees_to_csv,
    generate_sample_csv_template,
    import_employees_from_records,
    parse_ids_or_emails_for_deletion,
    parse_spreadsheet_data,
)


router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("")
def get_employees(
    page: int = 1,
    limit: int = 20,
    sort_by: str = "Emp_ID",
    order: str = "asc",
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """List employees with pagination, sorting, and role-based field filtering."""
    try:
        if page < 1 or limit < 1 or limit > 200:
            raise HTTPException(
                status_code=400,
                detail="page must be >= 1 and limit must be between 1 and 200"
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
            "items": [employee_view(e, current_user.role) for e in items]
        }

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.get("/template")
def download_template(
    current_user: UserDB = Depends(get_current_user)
):
    """Download a CSV sample template showing supported columns."""
    csv_data = generate_sample_csv_template()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=employee_template.csv"}
    )


@router.post("/upload-excel")
@limiter.limit("10/minute")
async def upload_employees_excel(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """
    Admin only. Bulk import employees from an Excel (.xlsx / .xls) or CSV sheet.
    Resolves departments by Name or ID, auto-generates missing IDs and company emails,
    and returns a summary report of inserted vs skipped rows with detailed error reasons.
    """
    filename = file.filename or "uploaded_file.xlsx"
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    if ext not in ("xlsx", "xls", "csv"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '.{ext}'. Please upload an Excel (.xlsx) or CSV (.csv) file."
        )

    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty."
            )

        records = parse_spreadsheet_data(file_bytes, filename)
        if not records:
            raise HTTPException(
                status_code=400,
                detail="No employee rows found in the sheet. Please make sure headers are present in the first row."
            )

        result = import_employees_from_records(
            db, records, current_user.username)
        return {
            "message": f"Processed {filename}: {result['inserted']} employees added, {result['skipped']} skipped",
            **result
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error reading file {filename}: {str(e)}"
        )


@router.get("/export")
def export_employees(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Export the employee directory to CSV.
    Role-based rules apply: users see public info; managers and admins see full compensation and addresses.
    """
    query = db.query(EmployeeDB)
    if not include_inactive:
        query = query.filter(EmployeeDB.is_active == True)  # noqa: E712
    employees = query.order_by(EmployeeDB.Emp_ID.asc()).all()

    depts = db.query(DepartmentDB).all()
    dept_map = {d.Dept_ID: d.Dept_Name for d in depts}

    csv_data = export_employees_to_csv(employees, current_user.role, dept_map)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=employees_export.csv"},
    )


@router.post("/bulk-delete")
@limiter.limit("10/minute")
def bulk_delete_employees(
    request: Request,
    payload: BulkEmployeeDelete,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin),
):
    """
    Admin only. Delete or deactivate multiple employees by their Emp_IDs.
    - If hard_delete=True, removes records and salary logs permanently.
    - If hard_delete=False (default), soft-deactivates the records.
    """
    if not payload.emp_ids:
        raise HTTPException(
            status_code=400, detail="emp_ids list cannot be empty")

    try:
        employees = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID.in_(payload.emp_ids)).all()
        found_ids = [e.Emp_ID for e in employees]
        missing_ids = [eid for eid in payload.emp_ids if eid not in found_ids]

        if not found_ids:
            return {
                "message": "None of the specified employee IDs were found.",
                "affected_count": 0,
                "not_found_ids": missing_ids,
            }

        if payload.hard_delete:
            db.query(SalaryHistoryDB).filter(SalaryHistoryDB.Emp_ID.in_(
                found_ids)).delete(synchronize_session=False)
            db.query(EmployeeDB).filter(EmployeeDB.Emp_ID.in_(
                found_ids)).delete(synchronize_session=False)
            action = "permanently deleted"
        else:
            for emp in employees:
                emp.is_active = False
            action = "deactivated (soft delete)"

        db.commit()

        return {
            "message": f"Successfully {action} {len(found_ids)} employee(s)",
            "affected_count": len(found_ids),
            "affected_ids": found_ids,
            "not_found_ids": missing_ids,
            "hard_delete": payload.hard_delete,
        }
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.post("/bulk-deactivate")
@limiter.limit("10/minute")
def bulk_deactivate_employees(
    request: Request,
    emp_ids: list[int],
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin),
):
    """Admin only. Soft-deactivate a list of employee IDs."""
    if not emp_ids:
        raise HTTPException(
            status_code=400, detail="emp_ids list cannot be empty")
    try:
        employees = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID.in_(emp_ids)).all()
        found_ids = [e.Emp_ID for e in employees]
        missing_ids = [eid for eid in emp_ids if eid not in found_ids]

        for emp in employees:
            emp.is_active = False
        db.commit()

        return {
            "message": f"Successfully deactivated {len(found_ids)} employee(s)",
            "deactivated_count": len(found_ids),
            "deactivated_ids": found_ids,
            "not_found_ids": missing_ids,
        }
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.post("/bulk-restore")
@limiter.limit("10/minute")
def bulk_restore_employees(
    request: Request,
    emp_ids: list[int],
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin),
):
    """Admin only. Restore / reactivate a list of inactive employee IDs."""
    if not emp_ids:
        raise HTTPException(
            status_code=400, detail="emp_ids list cannot be empty")
    try:
        employees = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID.in_(emp_ids)).all()
        found_ids = [e.Emp_ID for e in employees]
        missing_ids = [eid for eid in emp_ids if eid not in found_ids]

        for emp in employees:
            emp.is_active = True
        db.commit()

        return {
            "message": f"Successfully restored {len(found_ids)} employee(s)",
            "restored_count": len(found_ids),
            "restored_ids": found_ids,
            "not_found_ids": missing_ids,
        }
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.post("/bulk-delete-excel")
@limiter.limit("10/minute")
async def bulk_delete_employees_via_excel(
    request: Request,
    file: UploadFile = File(...),
    hard_delete: bool = False,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin),
):
    """
    Admin only. Bulk delete or deactivate employees using an uploaded Excel (.xlsx) or CSV file.
    The spreadsheet may contain an 'Emp_ID' or 'Email' column (or a single column of IDs/Emails).
    """
    filename = file.filename or "deletion_list.xlsx"
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    if ext not in ("xlsx", "xls", "csv"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '.{ext}'. Please upload an Excel (.xlsx) or CSV (.csv) file."
        )

    try:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(
                status_code=400, detail="Uploaded file is empty.")

        emp_ids, emails = parse_ids_or_emails_for_deletion(
            file_bytes, filename)
        if not emp_ids and not emails:
            raise HTTPException(
                status_code=400,
                detail="No employee IDs or emails found in the uploaded file."
            )

        from sqlalchemy import or_

        conditions = []
        if emp_ids:
            conditions.append(EmployeeDB.Emp_ID.in_(emp_ids))
        if emails:
            conditions.append(EmployeeDB.Email.in_(emails))

        employees = db.query(EmployeeDB).filter(or_(*conditions)).all()
        matched_ids = [e.Emp_ID for e in employees]

        if not employees:
            return {
                "message": "No matching employees found in database to delete.",
                "affected_count": 0,
                "parsed_identifiers": {"ids_count": len(emp_ids), "emails_count": len(emails)},
            }

        if hard_delete:
            db.query(SalaryHistoryDB).filter(SalaryHistoryDB.Emp_ID.in_(
                matched_ids)).delete(synchronize_session=False)
            db.query(EmployeeDB).filter(EmployeeDB.Emp_ID.in_(
                matched_ids)).delete(synchronize_session=False)
            action = "permanently deleted"
        else:
            for emp in employees:
                emp.is_active = False
            action = "deactivated (soft delete)"

        db.commit()

        return {
            "message": f"Successfully {action} {len(matched_ids)} employee(s) from {filename}",
            "affected_count": len(matched_ids),
            "affected_ids": matched_ids,
            "hard_delete": hard_delete,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Error processing deletion file: {str(e)}")


@router.get("/{emp_id}")
def get_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Retrieve individual employee profile by ID."""
    try:
        employee = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == emp_id).first()
        if employee is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        return employee_view(employee, current_user.role)

    except HTTPException:
        raise
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.post("")
@limiter.limit("10/minute")
def create_employee(
    request: Request,
    employee: Employee,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_manager_or_admin)
):
    """Manager/Admin only. Create a new employee and auto-generate their email."""
    try:
        existing = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == employee.Emp_ID).first()
        if existing:
            raise HTTPException(
                status_code=409, detail="Employee ID already exists")

        dept = db.query(DepartmentDB).filter(
            DepartmentDB.Dept_ID == employee.Dept_ID).first()
        if dept is None:
            raise HTTPException(
                status_code=400, detail="Dept_ID does not exist")

        payload = employee.model_dump(exclude={"joining_date"})
        new_employee = EmployeeDB(**payload)
        new_employee.Email = generate_employee_email(
            db, employee.F_Name, employee.L_Name, joining_date=employee.joining_date
        )

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


@router.put("/{emp_id}")
@limiter.limit("10/minute")
def update_employee(
    request: Request,
    emp_id: int,
    employee: Employee,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_manager_or_admin)
):
    """Manager/Admin only. Full update of employee details (salary changes require admin)."""
    try:
        existing = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == emp_id).first()
        if existing is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        if float(existing.Salary) != employee.Salary:
            if current_user.role != "admin":
                raise HTTPException(
                    status_code=403,
                    detail="Only an admin can change an existing salary"
                )

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


@router.patch("/{emp_id}")
@limiter.limit("10/minute")
def patch_employee(
    request: Request,
    emp_id: int,
    employee: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_manager_or_admin)
):
    """Manager/Admin only. Partial update of employee details."""
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
            if current_user.role != "admin":
                raise HTTPException(
                    status_code=403,
                    detail="Only an admin can change an existing salary"
                )

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


@router.delete("/{emp_id}")
@router.delete("/{emp_id}/deactivate")
@limiter.limit("10/minute")
def deactivate_employee(
    request: Request,
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. Soft delete: sets is_active = False."""
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


@router.delete("/{emp_id}/delete")
@limiter.limit("10/minute")
def delete_employee(
    request: Request,
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. Hard delete: permanently removes record from database."""
    try:
        employee = db.query(EmployeeDB).filter(
            EmployeeDB.Emp_ID == emp_id).first()
        if employee is None:
            raise HTTPException(status_code=404, detail="Employee not found")

        db.delete(employee)
        db.commit()

        return {"message": "Employee deleted successfully"}

    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@router.post("/{emp_id}/restore")
@limiter.limit("10/minute")
def restore_employee(
    request: Request,
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(require_admin)
):
    """Admin only. Restores a deactivated employee (is_active = True)."""
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

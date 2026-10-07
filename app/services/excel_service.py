"""
Excel and CSV import service for Employee batch creation.
Supports both .xlsx (via openpyxl or pure-Python XML fallback) and .csv formats.
"""
import csv
import io
import re
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, Union

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.department import DepartmentDB
from app.models.employee import EmployeeDB, SalaryHistoryDB, EmergencyContactDB
from app.models.user import UserDB
from app.services.email_service import generate_employee_email


def normalize_header(header: str) -> str:
    """Normalize column header: lowercase, alphanumeric only."""
    return re.sub(r"[^a-z0-9]", "", str(header).lower())


HEADER_FIELD_MAP = {
    "empid": "Emp_ID",
    "id": "Emp_ID",
    "employeeid": "Emp_ID",
    "empno": "Emp_ID",
    "fname": "F_Name",
    "firstname": "F_Name",
    "first": "F_Name",
    "name": "F_Name",
    "lname": "L_Name",
    "lastname": "L_Name",
    "last": "L_Name",
    "surname": "L_Name",
    "salary": "Salary",
    "sal": "Salary",
    "pay": "Salary",
    "ctc": "Salary",
    "compensation": "Salary",
    "deptid": "Dept_ID",
    "departmentid": "Dept_ID",
    "deptname": "Dept_Name",
    "department": "Dept_Name",
    "departmentname": "Dept_Name",
    "dept": "Dept_Name",
    "address": "Address",
    "addr": "Address",
    "location": "Address",
    "city": "Address",
    "email": "Email",
    "emailid": "Email",
    "mail": "Email",
    "joiningdate": "joining_date",
    "doj": "joining_date",
    "joindate": "joining_date",
    "dateofjoining": "joining_date",
    "createdat": "joining_date",
    "active": "is_active",
    "isactive": "is_active",
    "status": "is_active",
    "username": "Username",
    "user": "Username",
    "login": "Username",
    "uname": "Username",
    "account": "Username",
    "action": "action",
    "operation": "action",
}


def _clean_salary(val: Any) -> Optional[float]:
    """Parse salary value, stripping currency signs and commas."""
    if val is None or val == "":
        return None
    if isinstance(val, (int, float, Decimal)):
        return float(val)
    # String cleanup: remove $, Rs, commas, spaces
    cleaned = re.sub(r"[^\d.-]", "", str(val).strip())
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def _clean_date(val: Any) -> Optional[Union[datetime, date, str]]:
    """Clean and parse date representations."""
    if val is None or val == "":
        return None
    if isinstance(val, (datetime, date)):
        return val
    # Handle string dates
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return s


def parse_csv_bytes(file_bytes: bytes) -> List[Dict[str, Any]]:
    """Parse CSV bytes into a list of row dicts."""
    try:
        text = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = file_bytes.decode("latin-1")

    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return []

    raw_headers = rows[0]
    data_rows = rows[1:]

    records = []
    for r in data_rows:
        if not any(cell.strip() for cell in r if isinstance(cell, str)):
            continue  # skip completely blank lines
        row_dict = {}
        for idx, header in enumerate(raw_headers):
            if idx < len(r):
                row_dict[header] = r[idx].strip()
        records.append(row_dict)

    return records


def parse_xlsx_with_openpyxl(file_bytes: bytes) -> Optional[List[Dict[str, Any]]]:
    """Attempt parsing .xlsx using openpyxl."""
    try:
        import openpyxl

        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []

        raw_headers = [str(h) if h is not None else "" for h in rows[0]]
        records = []
        for r in rows[1:]:
            if not any(c is not None and str(c).strip() != "" for c in r):
                continue
            row_dict = {}
            for idx, header in enumerate(raw_headers):
                if idx < len(r) and header:
                    row_dict[header] = r[idx]
            records.append(row_dict)
        return records
    except Exception:
        return None


def parse_xlsx_fallback(file_bytes: bytes) -> List[Dict[str, Any]]:
    """Fallback pure-Python parser for .xlsx using zipfile and xml.etree."""
    with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
        # 1. Parse shared strings table if present
        shared_strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            with z.open("xl/sharedStrings.xml") as f:
                tree = ET.parse(f)
                root = tree.getroot()
                ns = {
                    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
                for si in root.findall(".//main:si", ns):
                    texts = [t.text or "" for t in si.findall(".//main:t", ns)]
                    shared_strings.append("".join(texts))

        # 2. Parse first worksheet
        sheet_path = "xl/worksheets/sheet1.xml"
        if sheet_path not in z.namelist():
            # Try to find any sheet
            sheets = [n for n in z.namelist() if n.startswith(
                "xl/worksheets/sheet")]
            if not sheets:
                return []
            sheet_path = sheets[0]

        with z.open(sheet_path) as f:
            tree = ET.parse(f)
            root = tree.getroot()
            ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

            all_rows = []
            for row_el in root.findall(".//main:sheetData/main:row", ns):
                row_cells = {}
                for c in row_el.findall("main:c", ns):
                    ref = c.attrib.get("r", "")
                    col_letters = "".join(filter(str.isalpha, ref))
                    t_attr = c.attrib.get("t", "")
                    val_el = c.find("main:v", ns)
                    val = val_el.text if val_el is not None else ""

                    if t_attr == "s" and val.isdigit():
                        idx = int(val)
                        val = shared_strings[idx] if idx < len(
                            shared_strings) else ""

                    row_cells[col_letters] = val
                all_rows.append(row_cells)

            if not all_rows:
                return []

            # Determine column ordering from first row (headers)
            first_row = all_rows[0]
            sorted_cols = sorted(
                first_row.keys(),
                key=lambda x: (len(x), x)
            )
            raw_headers = [first_row[c].strip() for c in sorted_cols]

            records = []
            for r in all_rows[1:]:
                row_dict = {}
                has_content = False
                for idx, col in enumerate(sorted_cols):
                    header = raw_headers[idx]
                    val = r.get(col, "")
                    if str(val).strip():
                        has_content = True
                    row_dict[header] = val
                if has_content:
                    records.append(row_dict)

            return records


def parse_xls_with_xlrd(file_bytes: bytes) -> Optional[List[Dict[str, Any]]]:
    """Attempt parsing legacy Excel .xls (BIFF8) files using xlrd."""
    try:
        import xlrd
        wb = xlrd.open_workbook(file_contents=file_bytes)
        ws = wb.sheet_by_index(0)
        if ws.nrows == 0:
            return []

        raw_headers = [str(ws.cell_value(0, c)).strip() for c in range(ws.ncols)]
        records = []
        for r in range(1, ws.nrows):
            row_dict = {}
            has_val = False
            for c, header in enumerate(raw_headers):
                if not header:
                    continue
                cell_type = ws.cell_type(r, c)
                val = ws.cell_value(r, c)
                if cell_type == xlrd.XL_CELL_DATE:
                    try:
                        date_tuple = xlrd.xldate_as_tuple(val, wb.datemode)
                        val = f"{date_tuple[0]:04d}-{date_tuple[1]:02d}-{date_tuple[2]:02d}"
                    except Exception:
                        pass
                elif cell_type == xlrd.XL_CELL_NUMBER:
                    if float(val).is_integer():
                        val = int(val)
                elif cell_type == xlrd.XL_CELL_BOOLEAN:
                    val = bool(val)

                if str(val).strip() != "":
                    has_val = True
                row_dict[header] = val
            if has_val:
                records.append(row_dict)
        return records
    except Exception:
        return None


def parse_spreadsheet_data(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """Parse Excel (.xlsx/.xls) or CSV bytes into a list of row dictionaries."""
    lower_name = filename.lower()
    if lower_name.endswith(".csv"):
        return parse_csv_bytes(file_bytes)

    if lower_name.endswith(".xls") and not lower_name.endswith(".xlsx"):
        xls_res = parse_xls_with_xlrd(file_bytes)
        if xls_res is not None:
            return xls_res

    # Try openpyxl first for .xlsx
    res = parse_xlsx_with_openpyxl(file_bytes)
    if res is not None:
        return res

    # Try xlrd in case the file content is actually .xls format
    xls_res = parse_xls_with_xlrd(file_bytes)
    if xls_res is not None:
        return xls_res

    # Fallback to pure Python zip/xml
    return parse_xlsx_fallback(file_bytes)


def import_employees_from_records(
    db: Session,
    records: List[Dict[str, Any]],
    current_username: str
) -> Dict[str, Any]:
    """
    Validates, matches fields, and inserts employee records into the database.
    Returns detailed summary with counts and row-by-row error reporting.
    """
    # 1. Preload departments for fast lookup by ID or Name
    departments = db.query(DepartmentDB).all()
    dept_by_id = {d.Dept_ID: d for d in departments}
    dept_by_name = {d.Dept_Name.strip().lower(): d for d in departments}

    # 2. Get current highest Emp_ID to safely auto-generate missing IDs
    max_emp_id = db.query(func.max(EmployeeDB.Emp_ID)).scalar() or 100
    next_emp_id = max_emp_id + 1

    inserted_employees = []
    errors = []

    # row 1 is header, data starts at 2
    for index, raw_row in enumerate(records, start=2):
        # Map raw column names to canonical model fields
        row: Dict[str, Any] = {}
        for k, v in raw_row.items():
            norm_key = normalize_header(k)
            field = HEADER_FIELD_MAP.get(norm_key)
            if field:
                row[field] = v

        f_name = str(row.get("F_Name") or "").strip()
        l_name = str(row.get("L_Name") or "").strip()
        address = str(row.get("Address") or "").strip()
        raw_salary = row.get("Salary")
        raw_dept_id = row.get("Dept_ID")
        raw_dept_name = row.get("Dept_Name")
        raw_emp_id = row.get("Emp_ID")
        explicit_email = str(row.get("Email") or "").strip()
        joining_date = _clean_date(row.get("joining_date"))

        # Validation checks
        if not f_name:
            errors.append(
                {"row": index, "error": "Missing required field: First Name (F_Name)"})
            continue

        if not l_name:
            errors.append(
                {"row": index, "error": "Missing required field: Last Name (L_Name)"})
            continue

        salary = _clean_salary(raw_salary)
        if salary is None:
            errors.append({
                "row": index,
                "error": f"Invalid or missing Salary value '{raw_salary}' for {f_name} {l_name}"
            })
            continue

        if salary < 0:
            errors.append({
                "row": index,
                "error": f"Salary cannot be negative ({salary}) for {f_name} {l_name}"
            })
            continue

        if not address:
            address = "Not Provided"

        # Resolve Department ID
        resolved_dept_id: Optional[int] = None
        if raw_dept_id is not None and str(raw_dept_id).strip() != "":
            try:
                dept_int = int(float(str(raw_dept_id).strip()))
                if dept_int in dept_by_id:
                    resolved_dept_id = dept_int
            except (ValueError, TypeError):
                pass

        if resolved_dept_id is None and raw_dept_name:
            norm_dept_name = str(raw_dept_name).strip().lower()
            if norm_dept_name in dept_by_name:
                resolved_dept_id = dept_by_name[norm_dept_name].Dept_ID

        if resolved_dept_id is None:
            avail_names = ", ".join([d.Dept_Name for d in departments])
            errors.append({
                "row": index,
                "error": f"Department '{raw_dept_name or raw_dept_id}' not found. Available: [{avail_names}]"
            })
            continue

        # Parse active status / action
        is_active = True
        raw_active = row.get("is_active")
        raw_action = str(row.get("action") or "").strip().lower()
        if raw_action in ("deactivate", "inactive", "disable", "suspend"):
            is_active = False
        elif raw_action in ("activate", "active", "enable", "restore"):
            is_active = True
        elif raw_active is not None and str(raw_active).strip().lower() in ("false", "0", "no", "inactive"):
            is_active = False

        # Parse joining date
        parsed_j_date = None
        if joining_date:
            if isinstance(joining_date, (datetime, date)):
                parsed_j_date = joining_date.date() if isinstance(
                    joining_date, datetime) else joining_date
            else:
                try:
                    parsed_j_date = datetime.strptime(
                        str(joining_date)[:10], "%Y-%m-%d").date()
                except ValueError:
                    parsed_j_date = None

        # Check / Generate Email
        final_email: str
        if explicit_email:
            existing_email = db.query(EmployeeDB).filter(
                EmployeeDB.Email == explicit_email).first()
            if existing_email and (not raw_emp_id or existing_email.Emp_ID != int(float(str(raw_emp_id).strip())) if str(raw_emp_id).strip().replace('.','',1).isdigit() else True):
                final_email = generate_employee_email(
                    db, f_name, l_name, joining_date=joining_date)
            else:
                final_email = explicit_email
        else:
            final_email = generate_employee_email(
                db, f_name, l_name, joining_date=joining_date)

        # Resolve Emp_ID
        emp_id: int
        existing = None
        if raw_emp_id is not None and str(raw_emp_id).strip() != "":
            try:
                emp_id = int(float(str(raw_emp_id).strip()))
                existing = db.query(EmployeeDB).filter(
                    EmployeeDB.Emp_ID == emp_id).first()
            except (ValueError, TypeError):
                emp_id = next_emp_id
                next_emp_id += 1
        else:
            emp_id = next_emp_id
            next_emp_id += 1

        # If employee already exists: if inactive or active re-import, restore/update them!
        if existing:
            if not existing.is_active or is_active:
                existing.is_active = is_active
                existing.F_Name = f_name
                existing.L_Name = l_name
                existing.Salary = salary
                existing.Dept_ID = resolved_dept_id
                existing.Address = address
                if final_email:
                    existing.Email = final_email
                if parsed_j_date:
                    existing.joining_date = parsed_j_date

                # Log salary update history if salary changed
                if float(existing.Salary or 0) != salary:
                    db.add(SalaryHistoryDB(
                        Emp_ID=emp_id,
                        old_salary=float(existing.Salary or 0),
                        new_salary=salary,
                        changed_by=current_username,
                    ))

                # Also synchronize linked user account if exists
                linked_user = db.query(UserDB).filter(
                    (UserDB.emp_id == existing.Emp_ID) | (UserDB.email == existing.Email)
                ).first()
                if linked_user:
                    linked_user.is_active = is_active

                db.commit()
                inserted_employees.append({
                    "Emp_ID": existing.Emp_ID,
                    "F_Name": existing.F_Name,
                    "L_Name": existing.L_Name,
                    "Salary": float(existing.Salary),
                    "Dept_ID": existing.Dept_ID,
                    "Department": dept_by_id[resolved_dept_id].Dept_Name,
                    "Email": existing.Email,
                    "Address": existing.Address,
                })
                continue
            else:
                errors.append({
                    "row": index,
                    "emp_id": emp_id,
                    "error": f"Emp_ID {emp_id} already exists in database ({existing.F_Name} {existing.L_Name})"
                })
                continue

        new_emp = EmployeeDB(
            Emp_ID=emp_id,
            F_Name=f_name,
            L_Name=l_name,
            Salary=salary,
            Dept_ID=resolved_dept_id,
            Address=address,
            Email=final_email,
            is_active=is_active,
            joining_date=parsed_j_date or date.today(),
            created_at=datetime.combine(
                parsed_j_date or date.today(), datetime.min.time()),
        )

        try:
            db.add(new_emp)
            db.flush()  # test constraints

            # Log starting salary history
            db.add(SalaryHistoryDB(
                Emp_ID=emp_id,
                old_salary=0.00,
                new_salary=salary,
                changed_by=current_username,
            ))
            db.commit()

            inserted_employees.append({
                "Emp_ID": new_emp.Emp_ID,
                "F_Name": new_emp.F_Name,
                "L_Name": new_emp.L_Name,
                "Salary": float(new_emp.Salary),
                "Dept_ID": new_emp.Dept_ID,
                "Department": dept_by_id[resolved_dept_id].Dept_Name,
                "Email": new_emp.Email,
                "Address": new_emp.Address,
            })
        except Exception as insert_err:
            db.rollback()
            errors.append({
                "row": index,
                "emp_id": emp_id,
                "error": f"Failed to save {f_name} {l_name}: {str(insert_err)}"
            })

    return {
        "total_rows": len(records),
        "inserted": len(inserted_employees),
        "skipped": len(errors),
        "errors": errors,
        "employees": inserted_employees,
    }


def generate_sample_csv_template() -> str:
    """Returns sample CSV template text for admin download."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Emp_ID",
        "F_Name",
        "L_Name",
        "Salary",
        "Department",
        "Address",
        "Email",
        "Joining_Date"
    ])
    writer.writerow([
        "101",
        "Alice",
        "Smith",
        "75000",
        "Engineering",
        "123 Market St, San Francisco",
        "",
        "2026-01-15"
    ])
    writer.writerow([
        "102",
        "Bob",
        "Jones",
        "62000",
        "Human Resources",
        "456 Elm St, New York",
        "",
        "2026-02-01"
    ])
    writer.writerow([
        "",
        "Charlie",
        "Brown",
        "55000",
        "Sales",
        "789 Oak Ave, Chicago",
        "",
        "2026-03-10"
    ])
    return output.getvalue()


def generate_identifier_csv_template() -> str:
    """Returns sample CSV template for bulk activate, deactivate, or delete operations."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Emp_ID", "Email", "Username", "Notes"])
    writer.writerow(["101", "alice.smith@laesfera.co", "alice", "Operations Team"])
    writer.writerow(["102", "bob.jones@laesfera.co", "bob", "Engineering"])
    writer.writerow(["103", "", "priya", "Support"])
    return output.getvalue()


def parse_identifiers_from_spreadsheet(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Extracts employee IDs, emails, and usernames from an uploaded spreadsheet (.xlsx, .xls, .csv).
    Handles tables with headers ('Emp_ID', 'ID', 'Email', 'Username', etc.) or single-column lists.
    """
    records = parse_spreadsheet_data(file_bytes, filename)
    emp_ids: List[int] = []
    emails: List[str] = []
    usernames: List[str] = []

    for row in records:
        for k, v in row.items():
            if v is None:
                continue
            norm = normalize_header(k)
            str_val = str(v).strip()
            if not str_val:
                continue

            if norm in ("empid", "id", "employeeid", "empno"):
                try:
                    emp_ids.append(int(float(str_val)))
                except (ValueError, TypeError):
                    pass
            elif norm in ("email", "mail", "emailid", "useremail"):
                if "@" in str_val:
                    emails.append(str_val.lower())
            elif norm in ("username", "user", "login", "uname", "account"):
                usernames.append(str_val)
            else:
                # Fallback format checking when header is ambiguous (e.g. single-column lists)
                if "@" in str_val:
                    emails.append(str_val.lower())
                elif str_val.isdigit():
                    emp_ids.append(int(str_val))

    unique_ids = list(dict.fromkeys(emp_ids))
    unique_emails = list(dict.fromkeys(emails))
    unique_usernames = list(dict.fromkeys(usernames))
    return {
        "emp_ids": unique_ids,
        "emails": unique_emails,
        "usernames": unique_usernames,
        "total_rows": len(records),
    }


def parse_ids_or_emails_for_deletion(file_bytes: bytes, filename: str) -> Tuple[List[int], List[str]]:
    """Legacy compatibility helper."""
    parsed = parse_identifiers_from_spreadsheet(file_bytes, filename)
    return parsed["emp_ids"], parsed["emails"]


def bulk_activate_from_spreadsheet(
    db: Session,
    file_bytes: bytes,
    filename: str,
    current_username: str,
) -> Dict[str, Any]:
    """
    Admin only. Bulk activate / restore employees and linked user accounts from an uploaded spreadsheet (.xlsx, .xls, .csv).
    Matches records by Emp_ID, Email, or Username.
    """
    parsed = parse_identifiers_from_spreadsheet(file_bytes, filename)
    emp_ids = parsed["emp_ids"]
    emails = parsed["emails"]
    usernames = parsed["usernames"]

    if not emp_ids and not emails and not usernames:
        raise ValueError("No employee IDs, emails, or usernames found in the uploaded file.")

    from sqlalchemy import or_

    emp_conditions = []
    if emp_ids:
        emp_conditions.append(EmployeeDB.Emp_ID.in_(emp_ids))
    if emails:
        emp_conditions.append(EmployeeDB.Email.in_(emails))

    if usernames:
        users_with_emp = db.query(UserDB).filter(UserDB.username.in_(usernames)).all()
        user_emp_ids = [u.emp_id for u in users_with_emp if u.emp_id is not None]
        if user_emp_ids:
            emp_conditions.append(EmployeeDB.Emp_ID.in_(user_emp_ids))

    employees = db.query(EmployeeDB).filter(or_(*emp_conditions)).all() if emp_conditions else []
    matched_emp_ids = [e.Emp_ID for e in employees]
    matched_emails = [e.Email.lower() for e in employees if e.Email]

    for emp in employees:
        emp.is_active = True

    user_conditions = []
    if matched_emp_ids:
        user_conditions.append(UserDB.emp_id.in_(matched_emp_ids))
    if matched_emails:
        user_conditions.append(UserDB.email.in_(matched_emails))
    if usernames:
        user_conditions.append(UserDB.username.in_(usernames))

    users = db.query(UserDB).filter(or_(*user_conditions)).all() if user_conditions else []
    matched_usernames = [u.username for u in users]
    for u in users:
        u.is_active = True

    db.commit()

    found_emp_ids_set = set(matched_emp_ids)
    found_emails_set = set(matched_emails) | {u.email.lower() for u in users if u.email}
    found_usernames_set = set(matched_usernames)

    not_found = []
    for eid in emp_ids:
        if eid not in found_emp_ids_set:
            not_found.append(f"Emp_ID {eid}")
    for eml in emails:
        if eml.lower() not in found_emails_set:
            not_found.append(f"Email {eml}")
    for unm in usernames:
        if unm not in found_usernames_set:
            not_found.append(f"Username '{unm}'")

    total_affected = len(matched_emp_ids)
    return {
        "message": f"Successfully activated {total_affected} employee(s) and {len(users)} user account(s) from {filename}",
        "affected_count": total_affected,
        "affected_ids": matched_emp_ids,
        "users_affected_count": len(users),
        "affected_usernames": matched_usernames,
        "not_found": not_found,
        "filename": filename,
    }


def bulk_deactivate_from_spreadsheet(
    db: Session,
    file_bytes: bytes,
    filename: str,
    current_username: str,
) -> Dict[str, Any]:
    """
    Admin only. Bulk soft-deactivate employees and linked user accounts from an uploaded spreadsheet (.xlsx, .xls, .csv).
    Matches records by Emp_ID, Email, or Username.
    """
    parsed = parse_identifiers_from_spreadsheet(file_bytes, filename)
    emp_ids = parsed["emp_ids"]
    emails = parsed["emails"]
    usernames = parsed["usernames"]

    if not emp_ids and not emails and not usernames:
        raise ValueError("No employee IDs, emails, or usernames found in the uploaded file.")

    from sqlalchemy import or_

    emp_conditions = []
    if emp_ids:
        emp_conditions.append(EmployeeDB.Emp_ID.in_(emp_ids))
    if emails:
        emp_conditions.append(EmployeeDB.Email.in_(emails))

    if usernames:
        users_with_emp = db.query(UserDB).filter(UserDB.username.in_(usernames)).all()
        user_emp_ids = [u.emp_id for u in users_with_emp if u.emp_id is not None]
        if user_emp_ids:
            emp_conditions.append(EmployeeDB.Emp_ID.in_(user_emp_ids))

    employees = db.query(EmployeeDB).filter(or_(*emp_conditions)).all() if emp_conditions else []
    matched_emp_ids = [e.Emp_ID for e in employees]
    matched_emails = [e.Email.lower() for e in employees if e.Email]

    for emp in employees:
        emp.is_active = False

    user_conditions = []
    if matched_emp_ids:
        user_conditions.append(UserDB.emp_id.in_(matched_emp_ids))
    if matched_emails:
        user_conditions.append(UserDB.email.in_(matched_emails))
    if usernames:
        user_conditions.append(UserDB.username.in_(usernames))

    users = db.query(UserDB).filter(or_(*user_conditions)).all() if user_conditions else []
    matched_usernames = [u.username for u in users]
    for u in users:
        if u.username == current_username:
            continue
        u.is_active = False

    db.commit()

    found_emp_ids_set = set(matched_emp_ids)
    found_emails_set = set(matched_emails) | {u.email.lower() for u in users if u.email}
    found_usernames_set = set(matched_usernames)

    not_found = []
    for eid in emp_ids:
        if eid not in found_emp_ids_set:
            not_found.append(f"Emp_ID {eid}")
    for eml in emails:
        if eml.lower() not in found_emails_set:
            not_found.append(f"Email {eml}")
    for unm in usernames:
        if unm not in found_usernames_set:
            not_found.append(f"Username '{unm}'")

    total_affected = len(matched_emp_ids)
    return {
        "message": f"Successfully deactivated {total_affected} employee(s) and {len(users)} user account(s) from {filename}",
        "affected_count": total_affected,
        "affected_ids": matched_emp_ids,
        "users_affected_count": len(users),
        "affected_usernames": matched_usernames,
        "not_found": not_found,
        "filename": filename,
    }


def bulk_delete_from_spreadsheet(
    db: Session,
    file_bytes: bytes,
    filename: str,
    hard_delete: bool,
    current_username: str,
) -> Dict[str, Any]:
    """
    Admin only. Bulk delete or deactivate employees and linked users from an uploaded spreadsheet (.xlsx, .xls, .csv).
    - If hard_delete=True, removes records permanently (including salary history, emergency contacts, unlinking user accounts).
    - If hard_delete=False, soft-deactivates the records.
    """
    parsed = parse_identifiers_from_spreadsheet(file_bytes, filename)
    emp_ids = parsed["emp_ids"]
    emails = parsed["emails"]
    usernames = parsed["usernames"]

    if not emp_ids and not emails and not usernames:
        raise ValueError("No employee IDs, emails, or usernames found in the uploaded file.")

    from sqlalchemy import or_

    emp_conditions = []
    if emp_ids:
        emp_conditions.append(EmployeeDB.Emp_ID.in_(emp_ids))
    if emails:
        emp_conditions.append(EmployeeDB.Email.in_(emails))

    if usernames:
        users_with_emp = db.query(UserDB).filter(UserDB.username.in_(usernames)).all()
        user_emp_ids = [u.emp_id for u in users_with_emp if u.emp_id is not None]
        if user_emp_ids:
            emp_conditions.append(EmployeeDB.Emp_ID.in_(user_emp_ids))

    employees = db.query(EmployeeDB).filter(or_(*emp_conditions)).all() if emp_conditions else []
    matched_ids = [e.Emp_ID for e in employees]
    matched_emails = [e.Email.lower() for e in employees if e.Email]

    user_conditions = []
    if matched_ids:
        user_conditions.append(UserDB.emp_id.in_(matched_ids))
    if matched_emails:
        user_conditions.append(UserDB.email.in_(matched_emails))
    if usernames:
        user_conditions.append(UserDB.username.in_(usernames))

    users = db.query(UserDB).filter(or_(*user_conditions)).all() if user_conditions else []
    matched_usernames = [u.username for u in users]

    if not employees and not users:
        return {
            "message": "No matching employees or user accounts found in database to delete.",
            "affected_count": 0,
            "users_affected_count": 0,
            "not_found": [f"Emp_ID {x}" for x in emp_ids] + [f"Email {x}" for x in emails] + [f"Username '{x}'" for x in usernames],
            "filename": filename,
            "hard_delete": hard_delete,
        }

    if hard_delete:
        if matched_ids:
            db.query(SalaryHistoryDB).filter(SalaryHistoryDB.Emp_ID.in_(matched_ids)).delete(synchronize_session=False)
            db.query(EmergencyContactDB).filter(EmergencyContactDB.emp_id.in_(matched_ids)).delete(synchronize_session=False)
            db.query(UserDB).filter(UserDB.emp_id.in_(matched_ids)).update({UserDB.emp_id: None}, synchronize_session=False)
            db.query(EmployeeDB).filter(EmployeeDB.Emp_ID.in_(matched_ids)).delete(synchronize_session=False)

        del_user_ids = [u.id for u in users if u.username != current_username and u.emp_id is None]
        if del_user_ids:
            db.query(UserDB).filter(UserDB.id.in_(del_user_ids)).delete(synchronize_session=False)

        action = "permanently deleted"
    else:
        for emp in employees:
            emp.is_active = False
        for u in users:
            if u.username != current_username:
                u.is_active = False
        action = "deactivated (soft delete)"

    db.commit()

    found_emp_ids_set = set(matched_ids)
    found_emails_set = set(matched_emails) | {u.email.lower() for u in users if u.email}
    found_usernames_set = set(matched_usernames)

    not_found = []
    for eid in emp_ids:
        if eid not in found_emp_ids_set:
            not_found.append(f"Emp_ID {eid}")
    for eml in emails:
        if eml.lower() not in found_emails_set:
            not_found.append(f"Email {eml}")
    for unm in usernames:
        if unm not in found_usernames_set:
            not_found.append(f"Username '{unm}'")

    return {
        "message": f"Successfully {action} {len(matched_ids)} employee(s) and {len(users)} user account(s) from {filename}",
        "affected_count": len(matched_ids),
        "affected_ids": matched_ids,
        "users_affected_count": len(users),
        "affected_usernames": matched_usernames,
        "not_found": not_found,
        "hard_delete": hard_delete,
        "filename": filename,
    }


def export_employees_to_csv(employees: List[Any], role: str, dept_map: Dict[int, str]) -> str:
    """
    Exports employee records to CSV text, applying 3-tier role-based boundaries:
    - Admin: Whole employee dataset (All 19 attributes: ID, Name, Email, Dept ID, Department,
      Salary, Address, Joining Date, Status, Personal Phone, Blood Group, Date of Birth, Marital Status,
      Primary Emergency Contact Name/Phone/Relation, and Database Creation/Update timestamps).
    - Manager: Limited operational dataset (13 attributes: ID, Name, Email, Dept ID, Department,
      Address, Joining Date, Status, Personal Phone, Blood Group, Primary Emergency Contact Name/Phone —
      strictly excluding confidential company Salary, private DOB/marital status, and internal timestamps).
    - User/Employee: Minimum public directory dataset (6 attributes: ID, Name, Email, Department,
      Personal Phone — strictly excluding compensation, address, status, blood group,
      DOB, marital status, emergency contacts, and timestamps).
    """
    output = io.StringIO()
    writer = csv.writer(output)

    if role == "admin":
        headers = [
            "Emp_ID", "F_Name", "L_Name", "Email", "Dept_ID", "Department",
            "Salary", "Address", "Joining_Date", "Status", "Personal_Phone",
            "Blood_Group", "Date_Of_Birth", "Marital_Status",
            "Emergency_Contact_Name", "Emergency_Contact_Phone", "Emergency_Contact_Relation",
            "Created_At", "Updated_At",
        ]
    elif role == "manager":
        headers = [
            "Emp_ID", "F_Name", "L_Name", "Email", "Dept_ID", "Department",
            "Address", "Joining_Date", "Status", "Personal_Phone", "Blood_Group",
            "Emergency_Contact_Name", "Emergency_Contact_Phone",
        ]
    else:
        headers = [
            "Emp_ID", "F_Name", "L_Name", "Email", "Department", "Personal_Phone"
        ]

    writer.writerow(headers)

    for emp in employees:
        dept_name = dept_map.get(emp.Dept_ID, f"Dept #{emp.Dept_ID}")
        status = "Active" if emp.is_active else "Inactive"

        j_date_val = str(emp.joining_date) if getattr(emp, "joining_date", None) else (
            emp.created_at.strftime(
                "%Y-%m-%d") if getattr(emp, "created_at", None) else ""
        )

        if role == "admin":
            dob_val = str(emp.dob) if getattr(emp, "dob", None) else ""
            created_at_val = emp.created_at.strftime(
                "%Y-%m-%d %H:%M:%S") if getattr(emp, "created_at", None) else ""
            updated_at_val = emp.updated_at.strftime(
                "%Y-%m-%d %H:%M:%S") if getattr(emp, "updated_at", None) else ""

            ec_name, ec_phone, ec_rel = "", "", ""
            if hasattr(emp, "emergency_contacts") and emp.emergency_contacts:
                primary_c = emp.emergency_contacts[0]
                ec_name = primary_c.contact_name or ""
                ec_phone = primary_c.phone_primary or ""
                ec_rel = primary_c.relationship_type or ""

            writer.writerow([
                emp.Emp_ID,
                emp.F_Name,
                emp.L_Name,
                emp.Email or "",
                emp.Dept_ID,
                dept_name,
                float(emp.Salary) if emp.Salary is not None else 0.0,
                emp.Address or "",
                j_date_val,
                status,
                emp.personal_phone or "",
                emp.blood_group or "",
                dob_val,
                emp.marital_status or "",
                ec_name,
                ec_phone,
                ec_rel,
                created_at_val,
                updated_at_val,
            ])
        elif role == "manager":
            ec_name, ec_phone = "", ""
            if hasattr(emp, "emergency_contacts") and emp.emergency_contacts:
                primary_c = emp.emergency_contacts[0]
                ec_name = primary_c.contact_name or ""
                ec_phone = primary_c.phone_primary or ""

            writer.writerow([
                emp.Emp_ID,
                emp.F_Name,
                emp.L_Name,
                emp.Email or "",
                emp.Dept_ID,
                dept_name,
                emp.Address or "",
                j_date_val,
                status,
                emp.personal_phone or "",
                emp.blood_group or "",
                ec_name,
                ec_phone,
            ])
        else:
            # Regular user / employee role: basic contact directory data only
            writer.writerow([
                emp.Emp_ID,
                emp.F_Name,
                emp.L_Name,
                emp.Email or "",
                dept_name,
                emp.personal_phone or "",
            ])

    return output.getvalue()

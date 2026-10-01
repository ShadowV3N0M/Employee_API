"""
Standalone Excel / CSV Employee Importer Script.

Usage:
    python import_excel.py path/to/your_file.xlsx
    python import_excel.py path/to/your_file.csv

Or run without arguments to be prompted for the file path.
"""
from app.services.excel_service import import_employees_from_records, parse_spreadsheet_data
from app.database import SessionLocal
import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))


def main():
    print("=" * 65)
    print(" Employee Excel / CSV Batch Importer (Admin Tool)")
    print("=" * 65)

    if len(sys.argv) > 1:
        file_path = sys.argv[1].strip("\"'")
    else:
        file_path = input(
            "\nEnter the path to your Excel (.xlsx) or CSV (.csv) file: ").strip("\"'")

    if not os.path.exists(file_path):
        print(f"\n[ERROR] File not found: {file_path}")
        sys.exit(1)

    filename = os.path.basename(file_path)
    print(f"\nReading '{filename}'...")

    try:
        with open(file_path, "rb") as f:
            file_bytes = f.read()
    except Exception as e:
        print(f"[ERROR] Failed to open file: {e}")
        sys.exit(1)

    records = parse_spreadsheet_data(file_bytes, filename)
    if not records:
        print("[ERROR] No data found in the spreadsheet or invalid format.")
        sys.exit(1)

    print(f"Found {len(records)} row(s). Processing import...\n")

    db = SessionLocal()
    try:
        result = import_employees_from_records(
            db, records, current_username="admin")

        print("-" * 65)
        print(" IMPORT RESULTS")
        print("-" * 65)
        print(f" Total Rows in File: {result['total_rows']}")
        print(f" Successfully Added: {result['inserted']}")
        print(f" Skipped / Failed:   {result['skipped']}")
        print("-" * 65)

        if result["inserted"] > 0:
            print("\n Newly Added Employees:")
            for emp in result["employees"]:
                print(
                    f"   ✓ ID: {emp['Emp_ID']} | {emp['F_Name']} {emp['L_Name']} | Dept: {emp['Department']} | Email: {emp['Email']} | Salary: ${emp['Salary']:,.2f}")

        if result["errors"]:
            print("\n Skipped Rows (Reasons):")
            for err in result["errors"]:
                emp_str = f" [Emp_ID {err['emp_id']}]" if "emp_id" in err else ""
                print(f"   ✗ Row {err['row']}{emp_str}: {err['error']}")

        print("\n" + "=" * 65)
        print(" Import completed.")
        print("=" * 65)

    finally:
        db.close()


if __name__ == "__main__":
    main()

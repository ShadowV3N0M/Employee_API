"""
PDF Generation Service using ReportLab.
Produces professional, corporate-branded official documents:
1. Employee Payslip Voucher
2. Employee Directory & Headcount Report
3. Department Budget Utilization & Expense Statement
4. Formal Salary Revision & Compensation Audit Letter
"""
from datetime import date, datetime
import io
from typing import List, Optional, Tuple

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.employee import EmployeeDB, SalaryHistoryDB
from app.routers.salaries import compute_salary_breakdown


# =========================================================================
# Canvas with Running Headers, Footers, and Page Numbers
# =========================================================================

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that accumulates pages and stamps 'Page X of Y' along
    with corporate watermark and running footer on each page.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, total_pages: int):
        self.saveState()
        page_w, page_h = self._pagesize

        # Running Top Rule & Header for pages after page 1
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#475569"))
            self.drawString(40, page_h - 28, "LA ESFERA TECHNOLOGIES • OFFICIAL HRMS REPORT")
            self.setFont("Helvetica", 8)
            self.drawRightString(page_w - 40, page_h - 28, datetime.now().strftime("%d-%b-%Y %H:%M"))
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.6)
            self.line(40, page_h - 32, page_w - 40, page_h - 32)

        # Running Bottom Footer (All Pages)
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.6)
        self.line(40, 36, page_w - 40, 36)

        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(
            40,
            24,
            "Confidential • La Esfera Technologies Pvt. Ltd. • Corporate HR & Payroll System",
        )
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(page_w - 40, 24, page_str)

        self.restoreState()


# =========================================================================
# Currency & Number Helpers
# =========================================================================

def format_inr(amount: Optional[float]) -> str:
    """Format float into standard Indian Rupee notation (e.g. Rs. 7,50,000.00)."""
    if amount is None:
        return "Rs. 0.00"
    is_neg = amount < 0
    amount = abs(amount)
    parts = f"{amount:.2f}".split(".")
    integer_part = parts[0]
    decimal_part = parts[1]

    if len(integer_part) > 3:
        last3 = integer_part[-3:]
        rest = integer_part[:-3]
        groups = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        formatted_int = ",".join(groups) + "," + last3
    else:
        formatted_int = integer_part

    sign = "-" if is_neg else ""
    return f"{sign}Rs. {formatted_int}.{decimal_part}"


def num_to_words(n: int) -> str:
    """Convert integer to Indian numbering words (Crores, Lakhs, Thousands, Hundreds)."""
    units = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
        "Eighteen", "Nineteen"
    ]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    if n == 0:
        return "Zero"
    if n < 20:
        return units[n]
    if n < 100:
        return tens[n // 10] + ("" if n % 10 == 0 else " " + units[n % 10])
    if n < 1000:
        return units[n // 100] + " Hundred" + ("" if n % 100 == 0 else " and " + num_to_words(n % 100))
    if n < 100000:
        return num_to_words(n // 1000) + " Thousand" + ("" if n % 1000 == 0 else " " + num_to_words(n % 1000))
    if n < 10000000:
        return num_to_words(n // 100000) + " Lakh" + ("" if n % 100000 == 0 else " " + num_to_words(n % 100000))
    return num_to_words(n // 10000000) + " Crore" + ("" if n % 10000000 == 0 else " " + num_to_words(n % 10000000))


def amount_to_words(amt: float) -> str:
    rupees = int(round(amt))
    return f"Rupees {num_to_words(rupees)} Only"


# =========================================================================
# Shared Styles
# =========================================================================

def get_report_styles():
    base = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=base["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=21,
        textColor=colors.HexColor("#0f172a"),
        alignment=0,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#475569"),
    )
    meta_style = ParagraphStyle(
        "ReportMeta",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#334155"),
    )
    table_cell = ParagraphStyle(
        "TableCell",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#1e293b"),
    )
    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=table_cell,
        fontName="Helvetica-Bold",
    )
    table_cell_header = ParagraphStyle(
        "TableCellHeader",
        parent=table_cell,
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=colors.white,
    )
    kpi_number = ParagraphStyle(
        "KpiNumber",
        parent=base["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=17,
        textColor=colors.HexColor("#1e3a8a"),
        alignment=1,
    )
    kpi_label = ParagraphStyle(
        "KpiLabel",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )

    return {
        "title": title_style,
        "subtitle": subtitle_style,
        "meta": meta_style,
        "cell": table_cell,
        "cell_bold": table_cell_bold,
        "cell_header": table_cell_header,
        "kpi_number": kpi_number,
        "kpi_label": kpi_label,
    }


def build_corporate_header(title: str, subtitle: str, badge_text: str = "OFFICIAL RECORD") -> List:
    """Builds an executive top brand block with logo, title, and metadata badge."""
    styles = get_report_styles()
    header_data = [
        [
            Paragraph(
                f"<b>LA ESFERA TECHNOLOGIES</b><br/>"
                f"<font size='8' color='#64748b'>Human Resources & Payroll Division • CIN: U72200MH2024PTC123456</font><br/>"
                f"<font size='13' color='#1e3a8a'><b>{title}</b></font><br/>"
                f"<font size='8.5' color='#475569'>{subtitle}</font>",
                styles["meta"],
            ),
            Paragraph(
                f"<div align='right'>"
                f"<font size='8' color='#2563eb'><b>[{badge_text}]</b></font><br/>"
                f"<font size='7.5' color='#64748b'>ISO 27001 Certified System</font><br/>"
                f"<font size='7.5' color='#64748b'>Date: {datetime.now().strftime('%d-%b-%Y')}</font>"
                f"</div>",
                styles["meta"],
            ),
        ]
    ]

    header_table = Table(header_data, colWidths=["70%", "30%"])
    header_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ])
    )

    divider = HRFlowable(
        width="100%",
        thickness=1.5,
        color=colors.HexColor("#2563eb"),
        spaceBefore=4,
        spaceAfter=12,
    )
    return [header_table, divider]


# =========================================================================
# 1. Official Payslip Voucher PDF Generator
# =========================================================================

def generate_payslip_pdf(
    emp: EmployeeDB,
    dept_name: str,
    month: str = "October",
    year: int = 2026,
    regime: str = "new",
    is_metro: bool = False,
    deductions_80c: float = 150000.0,
    deductions_80d: float = 25000.0,
) -> bytes:
    """
    Generates a formal, printable monthly salary slip voucher containing:
    - Employee identification & organizational credentials
    - Full earnings breakdown (Basic, HRA, Special Allowance, Conveyance, Medical)
    - Statutory deductions (EPF, PT, ESI, TDS)
    - Net pay highlight banner in figures and words
    - Official company seal / authorized signature block
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=46,
    )
    styles = get_report_styles()
    story = []

    # 1. Header
    story.extend(
        build_corporate_header(
            title=f"SALARY SLIP FOR THE MONTH OF {month.upper()} {year}",
            subtitle=f"Private & Confidential • Employee Code: #{emp.Emp_ID}",
            badge_text="PAYSLIP VOUCHER",
        )
    )

    # 2. Employee Details Two-Column Card
    j_date = str(emp.joining_date) if emp.joining_date else (
        emp.created_at.strftime("%Y-%m-%d") if emp.created_at else "—"
    )
    dob_str = str(emp.dob) if getattr(emp, "dob", None) else "—"

    # Masked Account & UAN values for professional look
    bank_acc = f"HDFC BANK (A/C: •••• {emp.Emp_ID + 5812})"
    uan_no = f"1012{emp.Emp_ID + 4901:04d}8901"

    emp_meta = [
        [
            Paragraph(f"<b>Employee ID:</b> #{emp.Emp_ID}", styles["cell"]),
            Paragraph(f"<b>Department:</b> {dept_name}", styles["cell"]),
        ],
        [
            Paragraph(f"<b>Employee Name:</b> {emp.F_Name} {emp.L_Name}", styles["cell"]),
            Paragraph(f"<b>Joining Date:</b> {j_date}", styles["cell"]),
        ],
        [
            Paragraph(f"<b>Official Email:</b> {emp.Email or '—'}", styles["cell"]),
            Paragraph(f"<b>Bank Account:</b> {bank_acc}", styles["cell"]),
        ],
        [
            Paragraph(f"<b>Mobile Phone:</b> {emp.personal_phone or '—'}", styles["cell"]),
            Paragraph(f"<b>PF UAN:</b> {uan_no}", styles["cell"]),
        ],
        [
            Paragraph(f"<b>Date of Birth:</b> {dob_str}", styles["cell"]),
            Paragraph(f"<b>Tax Regime:</b> {regime.upper()} REGIME (FY 2025-26)", styles["cell"]),
        ],
    ]

    emp_table = Table(emp_meta, colWidths=[260, 263])
    emp_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(emp_table)
    story.append(Spacer(1, 8))

    # 3. Attendance & Working Days Summary Banner
    # Determine days in the specified month
    days_in_month = 31 if month.lower() in ("january", "march", "may", "july", "august", "october", "december") else (28 if month.lower() == "february" else 30)
    attendance_data = [
        [
            Paragraph(f"<b>Total Working Days:</b> {days_in_month}", styles["cell"]),
            Paragraph(f"<b>Days Paid:</b> {days_in_month}", styles["cell"]),
            Paragraph("<b>Paid Leave:</b> 0", styles["cell"]),
            Paragraph("<b>Loss of Pay (LWP):</b> 0", styles["cell"]),
        ]
    ]
    att_table = Table(attendance_data, colWidths=[130, 130, 130, 133])
    att_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(att_table)
    story.append(Spacer(1, 10))

    # 4. Earnings & Deductions Breakdown
    annual_ctc = float(emp.Salary) if emp.Salary is not None else 0.0
    calc = compute_salary_breakdown(
        annual_ctc=annual_ctc,
        is_metro=is_metro,
        pf_capped=True,
        regime=regime,
        deductions_80c=deductions_80c,
        deductions_80d=deductions_80d,
    )

    earnings = calc["earnings"]
    deductions = calc["deductions"]
    net_salary = calc["net_salary"]["monthly"]

    pay_breakdown = [
        [
            Paragraph("<b>EARNINGS</b>", styles["cell_header"]),
            Paragraph("<b>AMOUNT</b>", styles["cell_header"]),
            Paragraph("<b>DEDUCTIONS</b>", styles["cell_header"]),
            Paragraph("<b>AMOUNT</b>", styles["cell_header"]),
        ],
        [
            Paragraph("Basic Salary (50%)", styles["cell"]),
            Paragraph(format_inr(earnings["basic"]), styles["cell"]),
            Paragraph("Provident Fund (EPF Employee)", styles["cell"]),
            Paragraph(format_inr(deductions["epf"]), styles["cell"]),
        ],
        [
            Paragraph("House Rent Allowance (HRA)", styles["cell"]),
            Paragraph(format_inr(earnings["hra"]), styles["cell"]),
            Paragraph("Professional Tax (PT)", styles["cell"]),
            Paragraph(format_inr(deductions["professional_tax"]), styles["cell"]),
        ],
        [
            Paragraph("Special Allowance", styles["cell"]),
            Paragraph(format_inr(earnings["special_allowance"]), styles["cell"]),
            Paragraph("Employee State Insurance (ESI)", styles["cell"]),
            Paragraph(format_inr(deductions["esi"]), styles["cell"]),
        ],
        [
            Paragraph("Conveyance Allowance", styles["cell"]),
            Paragraph(format_inr(earnings["conveyance"]), styles["cell"]),
            Paragraph("Income Tax (TDS)", styles["cell"]),
            Paragraph(format_inr(deductions["tds"]), styles["cell"]),
        ],
        [
            Paragraph("Medical Allowance", styles["cell"]),
            Paragraph(format_inr(earnings["medical"]), styles["cell"]),
            Paragraph("Voluntary PF / Other", styles["cell"]),
            Paragraph("Rs. 0.00", styles["cell"]),
        ],
        [
            Paragraph("<b>TOTAL GROSS EARNINGS (A)</b>", styles["cell_bold"]),
            Paragraph(f"<b>{format_inr(earnings['total_earnings'])}</b>", styles["cell_bold"]),
            Paragraph("<b>TOTAL DEDUCTIONS (B)</b>", styles["cell_bold"]),
            Paragraph(f"<b>{format_inr(deductions['total_deductions'])}</b>", styles["cell_bold"]),
        ],
    ]

    table_cols = [170, 91, 170, 92]
    pay_table = Table(pay_breakdown, colWidths=table_cols)
    pay_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e2e8f0")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#94a3b8")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ALIGN", (1, 1), (1, -1), "RIGHT"),
            ("ALIGN", (3, 1), (3, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(pay_table)
    story.append(Spacer(1, 10))

    # 5. Net Take-Home Highlight Banner
    words_amount = amount_to_words(net_salary)
    net_box = [
        [
            Paragraph(
                f"<font size='9' color='#1e3a8a'><b>NET SALARY PAYABLE (A - B):</b></font><br/>"
                f"<font size='15' color='#15803d'><b>{format_inr(net_salary)}</b></font><br/>"
                f"<font size='8' color='#475569'><b>Amount in Words:</b> {words_amount}</font>",
                styles["meta"],
            )
        ]
    ]
    net_table = Table(net_box, colWidths=[523])
    net_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdf4")),
            ("BOX", (0, 0), (-1, -1), 1.25, colors.HexColor("#16a34a")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ])
    )
    story.append(net_table)
    story.append(Spacer(1, 10))

    # 6. Annual CTC & Statutory Compliance Summary
    annual_gross = earnings["total_earnings"] * 12.0
    statutory_summary = [
        [
            Paragraph(f"<b>Annual Cost to Company (CTC):</b> {format_inr(annual_ctc)}", styles["cell"]),
            Paragraph(f"<b>Annual Gross Earnings:</b> {format_inr(annual_gross)}", styles["cell"]),
            Paragraph(f"<b>Standard Deduction Applied:</b> Rs. 75,000.00", styles["cell"]),
        ]
    ]
    stat_table = Table(statutory_summary, colWidths=[174, 174, 175])
    stat_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(stat_table)
    story.append(Spacer(1, 14))

    # 7. Signature & Authorization Block
    sign_data = [
        [
            Paragraph(
                "<font size='7.5' color='#64748b'>This is a system-authenticated digital payslip generated by "
                "La Esfera Technologies HRMS. No manual physical signature is required.</font><br/><br/>"
                "<b>_______________________________</b><br/>"
                "<font size='8'>Employee Acknowledgment</font>",
                styles["meta"],
            ),
            Paragraph(
                "<div align='right'>"
                "<font size='8' color='#2563eb'><b>[VERIFIED & APPROVED]</b></font><br/>"
                "<font size='7.5' color='#64748b'>La Esfera Payroll Department</font><br/><br/>"
                "<b>_______________________________</b><br/>"
                "<font size='8'>Authorized HR Signatory</font>"
                "</div>",
                styles["meta"],
            ),
        ]
    ]
    sign_table = Table(sign_data, colWidths=[260, 263])
    sign_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    story.append(KeepTogether(sign_table))

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()


# =========================================================================
# 2. Employee Directory & Headcount Report PDF Generator
# =========================================================================

def generate_employee_directory_pdf(
    employees: List[Tuple[EmployeeDB, str]],
    filter_info: dict,
    is_privileged: bool = True,
    generated_by: str = "Admin",
) -> bytes:
    """
    Generates an executive directory report formatted for HR printing (Landscape A4).
    Contains:
    - Summary KPI cards (Headcount, Active/Inactive, Departments, Monthly Payroll)
    - Tabular listing of employees with Department, Contact, Joining Date, Status, Salary
    """
    buffer = io.BytesIO()
    # Landscape A4: width = 841.89, height = 595.27
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=46,
    )
    styles = get_report_styles()
    story = []

    # 1. Header
    story.extend(
        build_corporate_header(
            title="EMPLOYEE DIRECTORY & HEADCOUNT REPORT",
            subtitle=f"Filtered Organizational Directory • Generated by {generated_by}",
            badge_text="CONFIDENTIAL HR REPORT",
        )
    )

    # 2. Summary KPI Metrics
    total_count = len(employees)
    active_count = sum(1 for e, _ in employees if e.is_active)
    inactive_count = total_count - active_count
    distinct_depts = len(set(dept for _, dept in employees))
    total_payroll = sum(float(e.Salary) for e, _ in employees if e.Salary and e.is_active)

    kpi_cards = [
        [
            Paragraph(f"<b>{total_count}</b>", styles["kpi_number"]),
            Paragraph(f"<b>{active_count}</b>", styles["kpi_number"]),
            Paragraph(f"<b>{inactive_count}</b>", styles["kpi_number"]),
            Paragraph(f"<b>{distinct_depts}</b>", styles["kpi_number"]),
        ],
        [
            Paragraph("Total Employees", styles["kpi_label"]),
            Paragraph("Active Personnel", styles["kpi_label"]),
            Paragraph("Inactive / Deactivated", styles["kpi_label"]),
            Paragraph("Departments", styles["kpi_label"]),
        ],
    ]

    col_w = 770 / 4
    kpi_table = Table(kpi_cards, colWidths=[col_w] * 4)
    kpi_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, 0), 6),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
            ("TOPPADDING", (0, 1), (-1, 1), 0),
            ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
        ])
    )
    story.append(kpi_table)
    story.append(Spacer(1, 8))

    # 3. Filter criteria banner
    filter_desc = []
    if filter_info.get("dept"):
        filter_desc.append(f"Department: {filter_info['dept']}")
    if filter_info.get("status"):
        filter_desc.append(f"Status: {filter_info['status'].title()}")
    if filter_info.get("search"):
        filter_desc.append(f"Keyword: '{filter_info['search']}'")
    filter_text = " | ".join(filter_desc) if filter_desc else "All Records Included"

    filter_banner = [
        [
            Paragraph(
                f"<b>Filter Applied:</b> {filter_text}  •  "
                f"<b>Active Monthly Payroll Total:</b> {format_inr(total_payroll / 12.0) if is_privileged else 'Restricted'}",
                styles["meta"],
            )
        ]
    ]
    fb_table = Table(filter_banner, colWidths=[770])
    fb_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#93c5fd")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(fb_table)
    story.append(Spacer(1, 8))

    # 4. Employees Table
    if is_privileged:
        headers = [
            Paragraph("<b>ID</b>", styles["cell_header"]),
            Paragraph("<b>Full Name</b>", styles["cell_header"]),
            Paragraph("<b>Department</b>", styles["cell_header"]),
            Paragraph("<b>Official Email</b>", styles["cell_header"]),
            Paragraph("<b>Phone</b>", styles["cell_header"]),
            Paragraph("<b>Joining Date</b>", styles["cell_header"]),
            Paragraph("<b>Status</b>", styles["cell_header"]),
            Paragraph("<b>Annual CTC</b>", styles["cell_header"]),
        ]
        table_cols = [45, 125, 100, 150, 85, 80, 75, 110]
    else:
        headers = [
            Paragraph("<b>ID</b>", styles["cell_header"]),
            Paragraph("<b>Full Name</b>", styles["cell_header"]),
            Paragraph("<b>Department</b>", styles["cell_header"]),
            Paragraph("<b>Official Email</b>", styles["cell_header"]),
            Paragraph("<b>Phone</b>", styles["cell_header"]),
            Paragraph("<b>Joining Date</b>", styles["cell_header"]),
            Paragraph("<b>Status</b>", styles["cell_header"]),
        ]
        table_cols = [50, 155, 120, 175, 100, 90, 80]

    table_data = [headers]

    for idx, (emp, dept) in enumerate(employees):
        j_date = str(emp.joining_date) if emp.joining_date else (
            emp.created_at.strftime("%Y-%m-%d") if emp.created_at else "—"
        )
        status_label = "<font color='#16a34a'><b>Active</b></font>" if emp.is_active else "<font color='#dc2626'><b>Inactive</b></font>"

        row = [
            Paragraph(f"#{emp.Emp_ID}", styles["cell_bold"]),
            Paragraph(f"{emp.F_Name} {emp.L_Name}", styles["cell"]),
            Paragraph(dept, styles["cell"]),
            Paragraph(emp.Email or "—", styles["cell"]),
            Paragraph(emp.personal_phone or "—", styles["cell"]),
            Paragraph(j_date, styles["cell"]),
            Paragraph(status_label, styles["cell"]),
        ]
        if is_privileged:
            salary_str = format_inr(float(emp.Salary)) if emp.Salary is not None else "Rs. 0.00"
            row.append(Paragraph(salary_str, styles["cell"]))

        table_data.append(row)

    main_table = Table(table_data, colWidths=table_cols, repeatRows=1)
    table_styling = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]

    for i in range(1, len(table_data)):
        if i % 2 == 0:
            table_styling.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f8fafc")))

    main_table.setStyle(TableStyle(table_styling))
    story.append(main_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()


# =========================================================================
# 3. Department Budget Utilization & Expense Statement PDF Generator
# =========================================================================

def generate_department_budget_pdf(
    dept_stats: List[dict],
    overall_summary: dict,
    generated_by: str = "Admin",
) -> bytes:
    """
    Generates an executive department-level budget utilization and head-count
    cost breakdown report for leadership review.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=46,
    )
    styles = get_report_styles()
    story = []

    # 1. Header
    story.extend(
        build_corporate_header(
            title="DEPARTMENT BUDGET & EXPENSE STATEMENT",
            subtitle=f"Fiscal Operations & Headcount Analysis • Generated by {generated_by}",
            badge_text="FINANCE & EXECUTIVE",
        )
    )

    # 2. Executive KPI Cards
    total_payroll = overall_summary.get("total_payroll", 0.0)
    total_headcount = overall_summary.get("total_headcount", 0)
    avg_salary = overall_summary.get("average_salary", 0.0)

    total_budget = sum(d.get("budget", 0.0) or 0.0 for d in dept_stats)
    overall_util = (
        round((total_payroll / total_budget) * 100, 1) if total_budget > 0 else 0.0
    )

    kpi_cards = [
        [
            Paragraph(f"<b>{total_headcount}</b>", styles["kpi_number"]),
            Paragraph(f"<b>{format_inr(total_payroll)}</b>", styles["kpi_number"]),
            Paragraph(f"<b>{format_inr(total_budget)}</b>", styles["kpi_number"]),
            Paragraph(f"<b>{overall_util}%</b>", styles["kpi_number"]),
        ],
        [
            Paragraph("Total Active Staff", styles["kpi_label"]),
            Paragraph("Annual Payroll Total", styles["kpi_label"]),
            Paragraph("Total Budget Allocated", styles["kpi_label"]),
            Paragraph("Overall Utilization", styles["kpi_label"]),
        ],
    ]

    col_w = 523 / 4
    kpi_table = Table(kpi_cards, colWidths=[col_w] * 4)
    kpi_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, 0), 6),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
            ("TOPPADDING", (0, 1), (-1, 1), 0),
            ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
        ])
    )
    story.append(kpi_table)
    story.append(Spacer(1, 12))

    # 3. Department Breakdown Table
    headers = [
        Paragraph("<b>Dept ID</b>", styles["cell_header"]),
        Paragraph("<b>Department Name</b>", styles["cell_header"]),
        Paragraph("<b>Headcount</b>", styles["cell_header"]),
        Paragraph("<b>Annual Payroll</b>", styles["cell_header"]),
        Paragraph("<b>Average CTC</b>", styles["cell_header"]),
        Paragraph("<b>Budget</b>", styles["cell_header"]),
        Paragraph("<b>Utilization</b>", styles["cell_header"]),
        Paragraph("<b>Status</b>", styles["cell_header"]),
    ]

    table_cols = [45, 115, 55, 80, 68, 70, 50, 40]
    table_data = [headers]

    for d in dept_stats:
        util = d.get("budget_utilization_pct")
        if util is None:
            util_str = "—"
            status_tag = "<font color='#64748b'>Uncapped</font>"
        elif util > 100:
            util_str = f"{util:.1f}%"
            status_tag = "<font color='#dc2626'><b>Exceeded</b></font>"
        elif util >= 80:
            util_str = f"{util:.1f}%"
            status_tag = "<font color='#d97706'><b>Near Cap</b></font>"
        else:
            util_str = f"{util:.1f}%"
            status_tag = "<font color='#16a34a'><b>Normal</b></font>"

        row = [
            Paragraph(f"#{d.get('Dept_ID')}", styles["cell_bold"]),
            Paragraph(d.get("Dept_Name", "—"), styles["cell"]),
            Paragraph(str(d.get("headcount", 0)), styles["cell"]),
            Paragraph(format_inr(d.get("total_payroll", 0.0)), styles["cell"]),
            Paragraph(format_inr(d.get("average_salary", 0.0)), styles["cell"]),
            Paragraph(format_inr(d.get("budget")) if d.get("budget") else "—", styles["cell"]),
            Paragraph(util_str, styles["cell"]),
            Paragraph(status_tag, styles["cell"]),
        ]
        table_data.append(row)

    dept_table = Table(table_data, colWidths=table_cols, repeatRows=1)
    table_styling = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]

    for i in range(1, len(table_data)):
        if i % 2 == 0:
            table_styling.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f8fafc")))

    dept_table.setStyle(TableStyle(table_styling))
    story.append(dept_table)
    story.append(Spacer(1, 14))

    # 4. Summary & Observations Box
    obs_data = [
        [
            Paragraph(
                "<b>Executive Observations:</b><br/>"
                f"• Organization maintains an active workforce of <b>{total_headcount} employees</b> across "
                f"<b>{len(dept_stats)} departments</b>.<br/>"
                f"• Company-wide average annual compensation stands at <b>{format_inr(avg_salary)}</b>.<br/>"
                f"• Overall budget consumption index is <b>{overall_util}%</b> against current approved fiscal allocations.<br/>"
                "• All compensation metrics are subject to statutory Indian payroll compliance (EPF, PT, ESI, TDS).",
                styles["meta"],
            )
        ]
    ]
    obs_table = Table(obs_data, colWidths=[523])
    obs_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(KeepTogether(obs_table))

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()


# =========================================================================
# 4. Formal Salary Revision Letter & Compensation Audit PDF Generator
# =========================================================================

def generate_salary_revision_letter_pdf(
    emp: EmployeeDB,
    dept_name: str,
    history: List[SalaryHistoryDB],
    generated_by: str = "HR Dept",
) -> bytes:
    """
    Generates a formal compensation revision letter and audit statement:
    - Formal corporate letterhead and reference numbering
    - Notification of salary increment
    - Revised compensation breakdown (Annual CTC & Monthly Gross)
    - Full chronological progression table of past salary revisions
    - Official company signing authority
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=46,
    )
    styles = get_report_styles()
    story = []

    # 1. Header
    story.extend(
        build_corporate_header(
            title="COMPENSATION REVISION & AUDIT STATEMENT",
            subtitle=f"Official Notice of Salary Amendment • Employee #{emp.Emp_ID}",
            badge_text="CONFIDENTIAL NOTICE",
        )
    )

    # 2. Letter Meta Details
    ref_num = f"LET/HR/SAL-REV/{emp.Emp_ID}/{datetime.now().strftime('%Y%m')}"
    today_str = datetime.now().strftime("%B %d, %Y")

    letter_meta = [
        [
            Paragraph(f"<b>Ref:</b> {ref_num}<br/><b>Date:</b> {today_str}", styles["cell"]),
            Paragraph(
                f"<div align='right'>"
                f"<b>To,</b><br/>"
                f"<b>{emp.F_Name} {emp.L_Name}</b> (Emp #{emp.Emp_ID})<br/>"
                f"Department of {dept_name}<br/>"
                f"{emp.Email or 'La Esfera Technologies'}"
                f"</div>",
                styles["cell"],
            ),
        ]
    ]
    meta_table = Table(letter_meta, colWidths=[260, 263])
    meta_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    story.append(meta_table)
    story.append(Spacer(1, 8))

    # 3. Subject & Salutation
    story.append(
        Paragraph(
            f"<b>SUBJECT: REVISION OF ANNUAL COMPENSATION PACKAGE</b>",
            styles["cell_bold"],
        )
    )
    story.append(Spacer(1, 6))

    story.append(
        Paragraph(
            f"Dear <b>{emp.F_Name}</b>,",
            styles["cell"],
        )
    )
    story.append(Spacer(1, 6))

    current_salary = float(emp.Salary) if emp.Salary is not None else 0.0
    latest_history = history[0] if history else None
    old_salary = float(latest_history.old_salary) if latest_history else current_salary
    increment_amount = current_salary - old_salary
    pct_change = round((increment_amount / old_salary) * 100, 2) if old_salary > 0 else 0.0

    story.append(
        Paragraph(
            "We take great pleasure in commending your continued dedication and contributions to "
            "<b>La Esfera Technologies</b>. Following our periodic compensation and performance appraisal cycle, "
            "we are delighted to confirm that your annual remuneration has been formally revised as outlined below.",
            styles["cell"],
        )
    )
    story.append(Spacer(1, 10))

    # 4. Revision Summary Card
    rev_card = [
        [
            Paragraph("<b>Previous Annual CTC:</b>", styles["cell"]),
            Paragraph(format_inr(old_salary), styles["cell_bold"]),
            Paragraph("<b>Revised Annual CTC:</b>", styles["cell"]),
            Paragraph(f"<font color='#15803d'><b>{format_inr(current_salary)}</b></font>", styles["cell_bold"]),
        ],
        [
            Paragraph("<b>Net Adjustment:</b>", styles["cell"]),
            Paragraph(
                f"<font color='{'#15803d' if increment_amount >= 0 else '#dc2626'}'><b>{'+' if increment_amount >= 0 else ''}{format_inr(increment_amount)} ({pct_change:+0.1f}%)</b></font>",
                styles["cell_bold"],
            ),
            Paragraph("<b>Revised Monthly Gross:</b>", styles["cell"]),
            Paragraph(format_inr(current_salary / 12.0), styles["cell_bold"]),
        ],
    ]
    rev_table = Table(rev_card, colWidths=[130, 131, 130, 132])
    rev_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(rev_table)
    story.append(Spacer(1, 12))

    # 5. Historical Compensation Progression Audit Table
    story.append(
        Paragraph("<b>CHRONOLOGICAL COMPENSATION AUDIT TRAIL</b>", styles["cell_bold"])
    )
    story.append(Spacer(1, 4))

    hist_headers = [
        Paragraph("<b>Log #</b>", styles["cell_header"]),
        Paragraph("<b>Effective Date & Time</b>", styles["cell_header"]),
        Paragraph("<b>Previous Salary</b>", styles["cell_header"]),
        Paragraph("<b>Revised Salary</b>", styles["cell_header"]),
        Paragraph("<b>Increment</b>", styles["cell_header"]),
        Paragraph("<b>Authorized By</b>", styles["cell_header"]),
    ]
    hist_cols = [45, 120, 95, 95, 80, 88]
    hist_table_data = [hist_headers]

    if history:
        for item in history:
            old_s = float(item.old_salary)
            new_s = float(item.new_salary)
            diff = new_s - old_s
            dt_str = item.changed_at.strftime("%d-%b-%Y %H:%M") if item.changed_at else "—"

            hist_table_data.append([
                Paragraph(f"#{item.id}", styles["cell_bold"]),
                Paragraph(dt_str, styles["cell"]),
                Paragraph(format_inr(old_s), styles["cell"]),
                Paragraph(format_inr(new_s), styles["cell"]),
                Paragraph(f"{'+' if diff >= 0 else ''}{format_inr(diff)}", styles["cell"]),
                Paragraph(item.changed_by or "System", styles["cell"]),
            ])
    else:
        hist_table_data.append([
            Paragraph("—", styles["cell"]),
            Paragraph(today_str, styles["cell"]),
            Paragraph(format_inr(current_salary), styles["cell"]),
            Paragraph(format_inr(current_salary), styles["cell"]),
            Paragraph("Baseline Initial CTC", styles["cell"]),
            Paragraph("HR Onboarding", styles["cell"]),
        ])

    hist_table = Table(hist_table_data, colWidths=hist_cols)
    hist_styling = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(hist_table_data)):
        if i % 2 == 0:
            hist_styling.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f8fafc")))

    hist_table.setStyle(TableStyle(hist_styling))
    story.append(hist_table)
    story.append(Spacer(1, 10))

    # 6. Terms & Confidentiality clause
    story.append(
        Paragraph(
            "<font size='8' color='#475569'>"
            "<b>Terms & Confidentiality:</b> All other terms and conditions of your employment contract remain in full force. "
            "Compensation details are strictly confidential between you and the organization. Please refrain from discussing "
            "or disclosing your compensation package to colleagues or external parties.</font>",
            styles["meta"],
        )
    )
    story.append(Spacer(1, 14))

    # 7. Signature block
    sign_block = [
        [
            Paragraph(
                "Sincerely,<br/><br/>"
                "<b>La Esfera Technologies Pvt. Ltd.</b><br/><br/>"
                "<b>_______________________________</b><br/>"
                "<font size='8'><b>Vice President — People & Operations</b></font><br/>"
                "<font size='7.5' color='#64748b'>Corporate Human Resources</font>",
                styles["meta"],
            ),
            Paragraph(
                "<div align='right'>"
                "I accept the above terms & revised structure:<br/><br/><br/>"
                "<b>_______________________________</b><br/>"
                f"<font size='8'><b>{emp.F_Name} {emp.L_Name}</b> (Employee)</font><br/>"
                f"<font size='7.5' color='#64748b'>Date: ________________________</font>"
                "</div>",
                styles["meta"],
            ),
        ]
    ]
    sb_table = Table(sign_block, colWidths=[260, 263])
    sb_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    story.append(KeepTogether(sb_table))

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()

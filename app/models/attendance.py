"""Employee Attendance, Breaks, and Regularization SQLAlchemy models."""
from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean,
    DateTime, Date, ForeignKey, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from app.database import Base


class AttendanceDB(Base):
    """
    Daily attendance record for an employee.
    Enforces one record per employee per calendar date.
    """
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, autoincrement=True)
    emp_id = Column(
        Integer,
        ForeignKey("employee.Emp_ID", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attendance_date = Column(Date, nullable=False, index=True)
    clock_in = Column(DateTime, nullable=True)
    clock_out = Column(DateTime, nullable=True)

    # Status: "present", "late", "half_day", "absent", "on_leave", "holiday", "wfh"
    status = Column(String(30), default="present", nullable=False, index=True)
    # Work Mode: "office", "remote", "hybrid"
    work_mode = Column(String(20), default="office", nullable=False)

    # Working hour metrics (net hours worked = gross hours - break minutes)
    total_hours = Column(Numeric(5, 2), default=0.0, nullable=False)
    regular_hours = Column(Numeric(5, 2), default=0.0, nullable=False)
    overtime_hours = Column(Numeric(5, 2), default=0.0, nullable=False)

    # Shift punctuality & flags
    is_late = Column(Boolean, default=False, nullable=False)
    late_minutes = Column(Integer, default=0, nullable=False)
    is_half_day = Column(Boolean, default=False, nullable=False)

    notes = Column(String(500), nullable=True)
    ip_address = Column(String(50), nullable=True)
    device_info = Column(String(255), nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Ensure one attendance row per employee per day
    __table_args__ = (
        UniqueConstraint("emp_id", "attendance_date", name="uq_emp_attendance_date"),
    )

    employee = relationship("EmployeeDB", back_populates="attendance_records")
    breaks = relationship(
        "AttendanceBreakDB",
        back_populates="attendance",
        cascade="all, delete-orphan",
        order_by="AttendanceBreakDB.start_time.asc()",
    )


class AttendanceBreakDB(Base):
    """
    Breaks taken during an active shift (e.g. Lunch, Tea, Personal).
    Deducted from gross duration to determine net productive hours.
    """
    __tablename__ = "attendance_break"

    id = Column(Integer, primary_key=True, autoincrement=True)
    attendance_id = Column(
        Integer,
        ForeignKey("attendance.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Break Type: "lunch", "tea", "personal", "meeting"
    break_type = Column(String(30), default="lunch", nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=0, nullable=False)
    notes = Column(String(255), nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    attendance = relationship("AttendanceDB", back_populates="breaks")


class AttendanceRegularizationDB(Base):
    """
    Attendance regularization request submitted by an employee
    for missed punches, system glitches, or manual adjustments.
    Requires manager or admin approval.
    """
    __tablename__ = "attendance_regularization"

    id = Column(Integer, primary_key=True, autoincrement=True)
    emp_id = Column(
        Integer,
        ForeignKey("employee.Emp_ID", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attendance_date = Column(Date, nullable=False, index=True)
    requested_clock_in = Column(DateTime, nullable=False)
    requested_clock_out = Column(DateTime, nullable=True)
    reason = Column(String(500), nullable=False)

    # Status: "pending", "approved", "rejected"
    status = Column(String(20), default="pending", nullable=False, index=True)
    reviewed_by = Column(String(50), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(String(500), nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    employee = relationship("EmployeeDB", back_populates="regularization_requests")


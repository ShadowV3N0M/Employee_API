"""Pydantic schemas for Attendance, Timesheets, Breaks, and Regularization."""
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ClockInRequest(BaseModel):
    work_mode: Optional[str] = Field("office", description="office, remote, or hybrid")
    notes: Optional[str] = Field(None, max_length=500)


class ClockOutRequest(BaseModel):
    notes: Optional[str] = Field(None, max_length=500)


class BreakStartRequest(BaseModel):
    break_type: Optional[str] = Field("lunch", description="lunch, tea, personal, meeting")
    notes: Optional[str] = Field(None, max_length=255)


class BreakEndRequest(BaseModel):
    notes: Optional[str] = Field(None, max_length=255)


class AttendanceBreakOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    attendance_id: int
    break_type: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: int
    notes: Optional[str] = None


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    emp_id: int
    employee_name: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    attendance_date: date
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    status: str
    work_mode: str
    total_hours: float
    regular_hours: float
    overtime_hours: float
    is_late: bool
    late_minutes: int
    is_half_day: bool
    notes: Optional[str] = None
    ip_address: Optional[str] = None
    device_info: Optional[str] = None
    breaks: List[AttendanceBreakOut] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AttendanceTodayStatus(BaseModel):
    emp_id: Optional[int] = None
    employee_name: Optional[str] = None
    is_clocked_in: bool = False
    is_clocked_out: bool = False
    is_on_break: bool = False
    current_break_type: Optional[str] = None
    clock_in_time: Optional[datetime] = None
    clock_out_time: Optional[datetime] = None
    active_duration_seconds: int = 0
    total_break_minutes: int = 0
    status: Optional[str] = None
    work_mode: Optional[str] = "office"
    today_record: Optional[AttendanceOut] = None


class AttendanceSummaryKPIs(BaseModel):
    month: int
    year: int
    total_calendar_days: int
    working_days_so_far: int
    present_days: int
    on_time_days: int
    late_days: int
    half_days: int
    absent_days: int
    on_leave_days: int
    holiday_days: int
    total_work_hours: float
    total_overtime_hours: float
    avg_daily_hours: float
    on_time_rate_pct: float


class AttendanceMonthlyReport(BaseModel):
    kpis: AttendanceSummaryKPIs
    records: List[AttendanceOut]


class AttendanceRegularizeCreate(BaseModel):
    attendance_date: date
    requested_clock_in: datetime
    requested_clock_out: Optional[datetime] = None
    reason: str = Field(..., min_length=3, max_length=500)


class AttendanceRegularizeReview(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    review_notes: Optional[str] = Field(None, max_length=500)


class AttendanceRegularizeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    emp_id: int
    employee_name: Optional[str] = None
    attendance_date: date
    requested_clock_in: datetime
    requested_clock_out: Optional[datetime] = None
    reason: str
    status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    created_at: datetime


class TeamLiveMember(BaseModel):
    emp_id: int
    employee_name: str
    department_id: int
    department_name: str
    status: str  # "working", "on_break", "clocked_out", "not_in_yet"
    work_mode: Optional[str] = None
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    is_late: bool = False
    late_minutes: int = 0
    active_duration_seconds: int = 0
    current_break_type: Optional[str] = None


class TeamLiveRoster(BaseModel):
    total_employees: int
    currently_working: int
    currently_on_break: int
    clocked_out_today: int
    not_in_yet: int
    members: List[TeamLiveMember]


class AttendanceManualEntry(BaseModel):
    emp_id: int
    attendance_date: date
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    status: str = Field("present", description="present, late, half_day, absent, on_leave, holiday, wfh")
    work_mode: str = Field("office", description="office, remote, hybrid")
    notes: Optional[str] = Field(None, max_length=500)


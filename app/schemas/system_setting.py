"""System setting request and response schemas."""
from pydantic import BaseModel, Field


class SessionConfigResponse(BaseModel):
    timeout_minutes: int = Field(default=15, description="Portal session timeout in minutes")
    warning_seconds: int = Field(default=60, description="Warning countdown in seconds before logout")
    enabled: bool = Field(default=True, description="Whether session timeout is active")


class SessionConfigUpdate(BaseModel):
    timeout_minutes: int = Field(
        ...,
        ge=1,
        le=1440,
        description="Session timeout in minutes (must be between 1 and 1440)"
    )


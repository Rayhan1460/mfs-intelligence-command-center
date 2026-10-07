from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)


UserRole = Literal["ADMIN", "ANALYST", "REGIONAL_MANAGER", "MERCHANT", "AGENT", "JUDGE"]


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    role: UserRole
    linked_entity_type: str | None
    linked_entity_id: str | None


class LoginResponse(BaseModel):
    user: UserResponse


class LogoutResponse(BaseModel):
    status: Literal["logged_out"]
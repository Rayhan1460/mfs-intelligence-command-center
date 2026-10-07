import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from typing import cast

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.db.models import AuthSession, User
from app.db.session import get_db
from app.schemas.auth import LoginRequest, LoginResponse, LogoutResponse, UserResponse, UserRole
from app.security.audit import record_audit_event
from app.security.dependencies import get_current_user, hash_secret
from app.security.passwords import verify_password
from app.security.throttle import (
    clear_login_failures,
    is_login_throttled,
    record_login_failure,
)

router = APIRouter()
identity_router = APIRouter()
CSRF_COOKIE_NAME = "mfs_csrf"


def _throttle_key(request: Request, email: str) -> str:
    material = f"{email.casefold()}|{request.client.host if request.client else 'unknown'}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def _cookie_secure() -> bool:
    return (
        settings.session_cookie_secure
        or settings.environment.casefold() == "production"
        or settings.session_cookie_samesite == "none"
    )


def _check_login_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    allowed = {settings.frontend_origin.rstrip("/"), *[o.rstrip("/") for o in settings.cors_origins]}
    if origin and origin.rstrip("/") not in allowed:
        raise APIError(403, "origin_not_allowed", "The request origin is not allowed.")


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=cast(UserRole, user.role),
        linked_entity_type=user.linked_entity_type,
        linked_entity_id=user.linked_entity_id,
    )


def _issue_session(
    user: User,
    request: Request,
    response: Response,
    session: Session,
    event_type: str = "LOGIN_SUCCESS",
) -> LoginResponse:
    raw_token = secrets.token_urlsafe(48)
    csrf_token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    auth_session = AuthSession(
        user_id=user.id,
        token_hash=hash_secret(raw_token),
        csrf_token_hash=hash_secret(csrf_token),
        created_at=now,
        expires_at=now + timedelta(minutes=settings.session_ttl_minutes),
    )
    session.add(auth_session)
    session.flush()
    record_audit_event(
        session,
        event_type=event_type,
        actor_user_id=user.id,
        subject_type="auth_session",
        subject_id=auth_session.id,
        correlation_id=getattr(request.state, "correlation_id", None),
    )
    session.commit()

    cookie_options = {
        "max_age": settings.session_ttl_minutes * 60,
        "secure": _cookie_secure(),
        "samesite": settings.session_cookie_samesite,
        "path": "/",
    }
    response.set_cookie(
        settings.session_cookie_name,
        raw_token,
        httponly=True,
        **cookie_options,
    )
    response.set_cookie(
        CSRF_COOKIE_NAME,
        csrf_token,
        httponly=False,
        **cookie_options,
    )
    return LoginResponse(user=_user_response(user))


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: Session = Depends(get_db),
) -> LoginResponse:
    _check_login_origin(request)
    throttle_key = _throttle_key(request, str(payload.email))
    if is_login_throttled(throttle_key):
        raise APIError(429, "login_throttled", "Too many failed login attempts. Try again later.")

    user = session.scalar(select(User).where(User.email == str(payload.email).casefold()))
    if user is not None and not user.is_active:
        raise APIError(401, "inactive_account", "This account is currently inactive.")

    valid_password = bool(user and verify_password(user.password_hash, payload.password))
    if user is None or not valid_password:
        record_login_failure(throttle_key)
        record_audit_event(
            session,
            event_type="LOGIN_FAILURE",
            correlation_id=getattr(request.state, "correlation_id", None),
            metadata={"reason": "invalid_credentials"},
        )
        session.commit()
        raise APIError(401, "invalid_credentials", "Email or password is incorrect.")

    clear_login_failures(throttle_key)
    return _issue_session(user, request, response, session, event_type="LOGIN_SUCCESS")


@router.post("/demo-login", response_model=LoginResponse)
def demo_login(
    request: Request,
    response: Response,
    session: Session = Depends(get_db),
) -> LoginResponse:
    if not settings.demo_mode:
        raise APIError(404, "demo_mode_disabled", "Demo mode is disabled.")
    _check_login_origin(request)

    user = None
    if settings.demo_user_email:
        user = session.scalar(
            select(User).where(User.email == settings.demo_user_email.casefold(), User.is_active.is_(True))
        )
    if user is None:
        user = session.scalar(
            select(User).where(User.role == "ADMIN", User.is_active.is_(True)).order_by(User.created_at.asc())
        )
    if user is None:
        raise APIError(404, "demo_user_not_found", "No active demo account is available.")

    return _issue_session(user, request, response, session, event_type="DEMO_LOGIN_SUCCESS")


@router.post("/logout", response_model=LogoutResponse)
def logout(
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> LogoutResponse:
    auth_session = getattr(request.state, "auth_session", None)
    if auth_session is None:
        raise APIError(401, "session_invalid", "The session is invalid or expired.")
    auth_session.revoked_at = datetime.now(timezone.utc)
    record_audit_event(
        session,
        event_type="LOGOUT",
        actor_user_id=user.id,
        subject_type="auth_session",
        subject_id=auth_session.id,
        correlation_id=getattr(request.state, "correlation_id", None),
    )
    session.commit()
    response.delete_cookie(settings.session_cookie_name, path="/", secure=_cookie_secure(), httponly=True, samesite=settings.session_cookie_samesite)
    response.delete_cookie(CSRF_COOKIE_NAME, path="/", secure=_cookie_secure(), httponly=False, samesite=settings.session_cookie_samesite)
    return LogoutResponse(status="logged_out")


@identity_router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> UserResponse:
    return _user_response(user)
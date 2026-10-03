import hashlib
import hmac
from datetime import datetime, timezone
from typing import Callable

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import APIError
from app.db.models import AuthSession, User
from app.db.session import get_db

PUBLIC_ROLES = {"ADMIN", "ANALYST", "REGIONAL_MANAGER", "JUDGE"}
READ_ROLES = PUBLIC_ROLES | {"MERCHANT", "AGENT"}
PROPOSE_ROLES = {"ADMIN", "ANALYST", "REGIONAL_MANAGER"}
DECIDE_ROLES = {"ADMIN", "REGIONAL_MANAGER"}


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def get_current_user(
    request: Request,
    session: Session = Depends(get_db),
) -> User:
    raw_token = request.cookies.get(settings.session_cookie_name)
    if not raw_token:
        raise APIError(401, "authentication_required", "Authentication is required.")

    token_hash = hash_secret(raw_token)
    auth_session = session.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == token_hash,
            AuthSession.revoked_at.is_(None),
        )
    )
    now = datetime.now(timezone.utc)
    if auth_session is None or _as_utc(auth_session.expires_at) <= now:
        raise APIError(401, "session_invalid", "The session is invalid or expired.")

    user = session.get(User, auth_session.user_id)
    if user is None or not user.is_active:
        raise APIError(401, "session_invalid", "The session is invalid or expired.")

    if request.method.upper() not in {"GET", "HEAD", "OPTIONS"}:
        csrf_cookie = request.cookies.get("mfs_csrf")
        csrf_header = request.headers.get("X-CSRF-Token")
        if (
            not csrf_cookie
            or not csrf_header
            or not hmac.compare_digest(csrf_cookie, csrf_header)
            or not hmac.compare_digest(hash_secret(csrf_header), auth_session.csrf_token_hash)
        ):
            raise APIError(403, "csrf_validation_failed", "A valid CSRF token is required.")

    request.state.auth_session = auth_session
    return user


def require_roles(*roles: str) -> Callable[..., User]:
    allowed = set(roles)

    def role_dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise APIError(403, "forbidden", "You are not authorized to perform this action.")
        return user

    return role_dependency


def enforce_entity_scope(user: User, entity_type: str, entity_id: str) -> None:
    if user.role in {"ADMIN", "ANALYST", "REGIONAL_MANAGER", "JUDGE"}:
        return
    if user.role != entity_type.upper() or user.linked_entity_id != entity_id:
        raise APIError(403, "forbidden", "You are not authorized to access this entity.")


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
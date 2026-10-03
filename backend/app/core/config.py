from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SOURCE_ROOT = (
    REPOSITORY_ROOT
    / "source_assets"
    / "MFS_AI_Hackathon_2026-20261002T164011Z-1-001 (2)"
    / "MFS_AI_Hackathon_2026"
)


class Settings(BaseSettings):
    app_name: str = "MFS Intelligence Command Center API"
    environment: str = "development"
    database_url: str = (
        "postgresql+psycopg://mfs:change-this-local-password"
        "@localhost:5432/mfs_intelligence"
    )
    cors_origins: list[str] = ["http://127.0.0.1:3000", "http://localhost:3000"]
    source_assets_root: Path = Field(
        default=DEFAULT_SOURCE_ROOT,
        validation_alias="SOURCE_ASSETS_ROOT",
    )
    session_cookie_name: str = "mfs_session"
    session_ttl_minutes: int = Field(default=480, ge=1, le=10080)
    session_cookie_secure: bool = False
    session_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    frontend_origin: str = "http://127.0.0.1:3000"

    model_config = SettingsConfigDict(
        env_file=REPOSITORY_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        validate_assignment=True,
    )

    @field_validator("source_assets_root", mode="before")
    @classmethod
    def resolve_relative_source_root(cls, value):
        path = Path(value)
        if path.is_absolute():
            return path
        candidates = [
            REPOSITORY_ROOT / path,
            Path(__file__).resolve().parents[2] / path,
            Path.cwd() / path,
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate.resolve()
        return REPOSITORY_ROOT / path


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
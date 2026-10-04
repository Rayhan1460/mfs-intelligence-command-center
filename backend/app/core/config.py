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
    demo_mode: bool = False
    demo_user_email: str = "demo.admin@example.com"

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
        if path.is_absolute() and path.exists():
            return path

        unprefixed = Path(*path.parts[1:]) if path.parts and path.parts[0] == "backend" else path
        app_dir = Path(__file__).resolve().parents[2]
        repo_dir = Path(__file__).resolve().parents[3] if len(Path(__file__).resolve().parents) > 3 else app_dir

        candidates = [
            repo_dir / path,
            app_dir / path,
            Path.cwd() / path,
            app_dir / unprefixed,
            Path.cwd() / unprefixed,
            repo_dir / "backend" / unprefixed,
        ]
        for candidate in candidates:
            if candidate.exists() and candidate.is_dir():
                return candidate.resolve()
        return (repo_dir / path).resolve()


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
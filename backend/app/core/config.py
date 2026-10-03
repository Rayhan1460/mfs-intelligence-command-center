from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MFS Intelligence Command Center API"
    environment: str = "development"
    database_url: str = (
        "postgresql+psycopg://mfs:change-this-local-password"
        "@localhost:5432/mfs_intelligence"
    )
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
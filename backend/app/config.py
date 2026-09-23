from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    app_name: str = "Banora API"
    app_version: str = "0.1.0"
    frontend_url: str = "http://localhost:3000"
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "banora"
    db_user: str = "banora"
    db_password: str = ""
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    # Comma-separated list for multiple origins, e.g. "https://a.com,https://b.com".
    cors_allow_origins: str = ""
    auth_rate_limit_attempts: int = 10
    auth_rate_limit_window_seconds: int = 300

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def database_url(self) -> URL:
        return URL.create(
            drivername="postgresql+psycopg",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )

    @property
    def cors_origins(self) -> list[str]:
        """Allowed browser origins for credentialed CORS.

        cors_allow_origins wins when set (production), otherwise the single
        frontend_url is used (local development).
        """
        if self.cors_allow_origins.strip():
            return [
                origin.strip().rstrip("/")
                for origin in self.cors_allow_origins.split(",")
                if origin.strip()
            ]
        return [self.frontend_url]


@lru_cache
def get_settings() -> Settings:
    return Settings()
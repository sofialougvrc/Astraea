from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Astraea API"
    api_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    cors_origin_regex: str = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
    database_url: str = "postgresql+psycopg://astraea:astraea@localhost:5432/astraea"
    use_mock_store: bool = True

    class Config:
        env_file = ".env"
        env_prefix = "ASTRAEA_"


@lru_cache
def get_settings() -> Settings:
    return Settings()

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://localhost/rural_research"
    census_api_key: str = ""
    data_dir: Path = Path("./data")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)

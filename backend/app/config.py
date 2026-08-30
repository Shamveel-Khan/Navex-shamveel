from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="NAVEX_",
        extra="ignore",
    )

    dev_key: str = "dev-key-123"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_api_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "NAVEX_LLM_API_KEY", "NAVEX_OPENROUTER_API_KEY"
        ),
    )
    llm_model: str = Field(
        default="openai/gpt-4o-mini",
        validation_alias=AliasChoices("NAVEX_LLM_MODEL", "NAVEX_OPENROUTER_MODEL"),
    )
    llm_temperature: float = 0.0
    llm_max_tokens: int = 800

    max_agent_steps: int = 12


@lru_cache
def get_settings() -> Settings:
    return Settings()

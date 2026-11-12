from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EasyStock Portfolio API"
    nh_app_key: str = ""
    nh_app_secret: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

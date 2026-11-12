from typing import Literal

from pydantic import BaseModel, Field


class ConnectionCreate(BaseModel):
    broker_id: Literal["nh_namuh"]
    label: str = Field(min_length=1, max_length=40)
    app_key: str = Field(min_length=1, max_length=256)
    app_secret: str = Field(min_length=1, max_length=256)


class ConnectionSummary(BaseModel):
    id: str
    broker_id: str
    broker_name: str
    label: str

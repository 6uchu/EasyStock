from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class Position(BaseModel):
    code: str
    name: str
    target_weight: float = Field(ge=0, le=100)
    quantity: int = Field(ge=0)
    current_price: int = Field(ge=0)
    average_price: int = Field(ge=0)


class Portfolio(BaseModel):
    currency: str = "KRW"
    cash: int = Field(ge=0)
    positions: list[Position]


class PortfolioAccount(BaseModel):
    account_no: str
    account_type: str


class BacktestPosition(BaseModel):
    code: str = Field(min_length=1, max_length=12)
    name: str = Field(min_length=1, max_length=80)
    market: Literal["KR", "US"] = "KR"
    target_weight: float = Field(ge=0, le=100)


class BacktestRequest(BaseModel):
    start_date: date
    mode: Literal["once", "recurring"]
    frequency: Literal["weekly", "monthly"] = "monthly"
    investment_amount: float | None = Field(default=None, gt=0, le=1_000_000_000_000)
    positions: list[BacktestPosition] = Field(min_length=1, max_length=30)


class HistoryStartRequest(BaseModel):
    positions: list[BacktestPosition] = Field(min_length=1, max_length=30)

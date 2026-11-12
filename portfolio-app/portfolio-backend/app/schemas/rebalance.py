from pydantic import BaseModel, Field


class RebalanceRequest(BaseModel):
    budget: int = Field(gt=0)
    positions: list[dict]
    cash: int = Field(ge=0)


class OrderPreview(BaseModel):
    code: str
    name: str
    side: str
    quantity: int
    estimated_price: int
    estimated_amount: int


class RebalancePreview(BaseModel):
    orders: list[OrderPreview]
    estimated_cash_after: int
    message: str

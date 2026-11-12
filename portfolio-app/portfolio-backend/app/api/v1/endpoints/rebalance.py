from fastapi import APIRouter
from app.schemas.portfolio import Portfolio
from app.schemas.rebalance import RebalancePreview
from app.services.rebalancer import preview

router = APIRouter()


@router.post("/preview", response_model=RebalancePreview)
async def rebalance_preview(portfolio: Portfolio):
    total = sum(p.quantity * p.current_price for p in portfolio.positions) + portfolio.cash
    return preview(portfolio, total)

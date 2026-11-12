from fastapi import APIRouter
from app.api.v1.endpoints import connections, portfolio, rebalance

router = APIRouter(prefix="/api/v1")
router.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
router.include_router(rebalance.router, prefix="/rebalance", tags=["rebalance"])
router.include_router(connections.router, prefix="/connections", tags=["connections"])

from app.schemas.portfolio import Portfolio
from app.schemas.rebalance import OrderPreview, RebalancePreview


def preview(portfolio: Portfolio, budget: int) -> RebalancePreview:
    total = sum(p.quantity * p.current_price for p in portfolio.positions) + portfolio.cash
    investable = min(budget, total)
    orders: list[OrderPreview] = []
    cash_after = portfolio.cash
    for p in portfolio.positions:
        target_value = investable * p.target_weight / 100
        delta = target_value - p.quantity * p.current_price
        shares = int(abs(delta) // p.current_price) if p.current_price else 0
        if shares == 0:
            continue
        side = "buy" if delta > 0 else "sell"
        amount = shares * p.current_price
        cash_after += -amount if side == "buy" else amount
        orders.append(OrderPreview(code=p.code, name=p.name, side=side, quantity=shares,
                                   estimated_price=p.current_price, estimated_amount=amount))
    return RebalancePreview(orders=orders, estimated_cash_after=max(cash_after, 0),
                            message="Preview only. No order has been sent to the broker.")

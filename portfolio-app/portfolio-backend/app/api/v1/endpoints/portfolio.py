from datetime import date, timedelta
import calendar
import asyncio

from fastapi import APIRouter, HTTPException, Query
import httpx
import re
from typing import Any

from app.schemas.portfolio import BacktestRequest, HistoryStartRequest, Portfolio, PortfolioAccount, Position
from app.services.namuh_client import namuh_client
from app.services.instrument_search import search_instruments

router = APIRouter()


@router.post("/instruments/history-start")
async def instrument_history_start(
    profile_id: str = Query(min_length=1, max_length=50),
    request: HistoryStartRequest = ...,
):
    """Return the earliest daily quote currently available for each instrument."""
    results = []
    quote_calendars: list[set[str]] = []
    today = date.today()
    try:
        for index, position in enumerate(request.positions):
            if index:
                await asyncio.sleep(0.21)
            prices = await namuh_client.get_daily_prices(
                profile_id, position.market, position.code, today
            )
            quote_calendars.append({price["date"] for price in prices})
            results.append({
                "code": position.code,
                "market": position.market,
                "available_from_date": prices[0]["date"] if prices else None,
            })
    except (httpx.HTTPError, RuntimeError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"최초 시세일을 조회하지 못했습니다: {exc}") from exc
    common_dates = set.intersection(*quote_calendars) if quote_calendars and all(quote_calendars) else set()
    return {
        "positions": results,
        "all_positions_available_from_date": min(common_dates) if common_dates else None,
    }


@router.get("/instruments/search")
async def search_instrument_master(
    market: str = Query(pattern="^(KR|US)$"),
    query: str = Query(min_length=1, max_length=40),
):
    try:
        return await search_instruments(market, query)
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"종목 검색 목록을 불러오지 못했습니다: {exc}") from exc


@router.get("/instruments/lookup")
async def lookup_instrument(
    profile_id: str = Query(min_length=1, max_length=50),
    market: str = Query(pattern="^(KR|US)$"),
    code: str = Query(min_length=1, max_length=12),
):
    normalized = code.strip().upper()
    if market == "KR":
        if not re.fullmatch(r"[A-Z0-9]{6}", normalized):
            raise HTTPException(status_code=422, detail="국장 종목코드는 영문 대문자와 숫자 6자리로 입력해 주세요.")
    elif not re.fullmatch(r"[A-Z0-9.\-]{1,12}", normalized):
        raise HTTPException(status_code=422, detail="미장 종목코드는 영문 티커로 입력해 주세요.")
    try:
        return await namuh_client.search_instrument(profile_id, market, normalized)
    except (httpx.HTTPError, RuntimeError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=f"종목을 조회하지 못했습니다: {exc}") from exc


@router.get("/accounts", response_model=list[PortfolioAccount])
async def get_accounts(profile_id: str = Query(min_length=1, max_length=50)):
    try:
        return await namuh_client.list_accounts(profile_id)
    except (httpx.HTTPError, RuntimeError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"NH 계좌 목록을 가져오지 못했습니다: {exc}") from exc


@router.get("", response_model=Portfolio)
async def get_portfolio(
    account_no: str = Query(min_length=11, max_length=11),
    profile_id: str = Query(min_length=1, max_length=50),
):
    try:
        # Validate the selected account against the credential's account list.
        accounts = await namuh_client.list_accounts(profile_id)
        if not any(account["account_no"] == account_no for account in accounts):
            raise HTTPException(status_code=403, detail="선택한 계좌가 이 앱 키에 연결된 운영 계좌 목록에 없습니다.")

        balance = await namuh_client.get_balance(profile_id, account_no)
    except HTTPException:
        raise
    except (httpx.HTTPError, RuntimeError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"NH 잔고를 가져오지 못했습니다: {exc}") from exc

    summary = balance["summary"]
    rows = balance["holdings"]
    cash = int(float(summary.get("dca") or 0))
    holdings_value = sum(int(float(row.get("eal_amt") or 0)) for row in rows)
    total_value = holdings_value + cash

    positions = []
    for row in rows:
        quantity = int(float(row.get("itg_bnc_qty") or row.get("rsdl_qty") or 0))
        current_price = int(float(row.get("now_pr") or 0))
        average_price = int(float(row.get("phs_pr") or 0))
        code = str(row.get("iem_cd") or "").strip().zfill(6)
        if not code or quantity <= 0:
            continue
        value = int(float(row.get("eal_amt") or quantity * current_price))
        positions.append(Position(
            code=code,
            name=str(row.get("iem_nm") or code).strip(),
            # Until the user saves explicit targets, initialize each target at its
            # current weight so the first live view does not imply an arbitrary trade.
            target_weight=(value / total_value * 100) if total_value else 0,
            quantity=quantity,
            current_price=current_price,
            average_price=average_price,
        ))

    return Portfolio(cash=cash, positions=positions)


@router.post("/backtest")
async def backtest_portfolio(profile_id: str = Query(min_length=1, max_length=50), request: BacktestRequest = ...):
    """Simulate one-time or recurring purchases using historical daily closes."""
    today = date.today()
    if request.start_date > today:
        raise HTTPException(status_code=422, detail="매수 시작일은 오늘 이전 날짜로 선택해 주세요.")
    if request.mode == "once" and request.investment_amount is None:
        raise HTTPException(status_code=422, detail="1회 매수 금액을 입력해 주세요.")
    total_weight = sum(position.target_weight for position in request.positions)
    if total_weight <= 0:
        raise HTTPException(status_code=422, detail="불러온 포트폴리오의 목표 비중을 확인해 주세요.")

    schedule = [request.start_date]
    if request.mode == "recurring":
        schedule = []
        next_date = request.start_date
        while next_date <= today:
            schedule.append(next_date)
            if request.frequency == "weekly":
                next_date += timedelta(days=7)
            else:
                year = next_date.year + (next_date.month // 12)
                month = next_date.month % 12 + 1
                day = min(next_date.day, calendar.monthrange(year, month)[1])
                next_date = date(year, month, day)

    simulated_positions = []
    weighted_return = 0.0
    total_weighted_contributions = 0.0
    total_current_value = 0.0
    price_history: dict[str, list[dict[str, Any]]] = {}
    buy_history: dict[str, list[dict[str, Any]]] = {}
    try:
        for position in request.positions:
            if position.target_weight <= 0:
                continue
            if simulated_positions:
                await asyncio.sleep(0.21)
            prices = await namuh_client.get_daily_prices(
                profile_id, position.market, position.code, today
            )
            bars = [bar for bar in prices if bar["date"] >= request.start_date.strftime("%Y%m%d")]
            if not bars:
                raise ValueError(f"{position.name}의 선택한 기간 과거 시세가 없습니다.")

            buys = []
            if request.mode == "once":
                buys = [bars[0]]
            else:
                cursor = 0
                for scheduled_date in schedule:
                    scheduled_key = scheduled_date.strftime("%Y%m%d")
                    if scheduled_key < prices[0]["date"]:
                        continue
                    while cursor < len(bars) and bars[cursor]["date"] < scheduled_key:
                        cursor += 1
                    if cursor < len(bars):
                        bar = bars[cursor]
                        if not buys or buys[-1]["date"] != bar["date"]:
                            buys.append(bar)
            latest_price = prices[-1]["close"]
            if not buys and request.mode == "recurring":
                identity = f"{position.market}:{position.code}"
                price_history[identity] = prices
                buy_history[identity] = buys
                simulated_positions.append({
                    "code": position.code,
                    "name": position.name,
                    "market": position.market,
                    "available_from_date": prices[0]["date"],
                    "buy_count": 0,
                    "first_buy_date": None,
                    "last_buy_date": None,
                    "average_buy_price": None,
                    "latest_price": latest_price,
                    "return_pct": None,
                    "invested_amount": None,
                    "current_value": None,
                    "profit_amount": None,
                })
                continue
            if not buys:
                raise ValueError(f"{position.name}에 적용할 수 있는 매수일이 없습니다.")

            identity = f"{position.market}:{position.code}"
            price_history[identity] = prices
            buy_history[identity] = buys

            share_units = sum(1 / bar["close"] for bar in buys)
            average_price = len(buys) / share_units if share_units else 0
            return_pct = (latest_price / average_price - 1) * 100 if average_price else 0
            invested_amount = None
            current_value = None
            profit_amount = None
            if request.mode == "once" and request.investment_amount is not None:
                invested_amount = request.investment_amount * position.target_weight / total_weight
                current_value = invested_amount * latest_price / average_price if average_price else 0
                profit_amount = current_value - invested_amount
                total_current_value += current_value
            contribution_weight = position.target_weight * len(buys)
            weighted_return += return_pct * contribution_weight
            total_weighted_contributions += contribution_weight
            simulated_positions.append({
                "code": position.code,
                "name": position.name,
                "market": position.market,
                "available_from_date": prices[0]["date"],
                "buy_count": len(buys),
                "first_buy_date": buys[0]["date"],
                "last_buy_date": buys[-1]["date"],
                "average_buy_price": average_price,
                "latest_price": latest_price,
                "return_pct": return_pct,
                "invested_amount": invested_amount,
                "current_value": current_value,
                "profit_amount": profit_amount,
            })
    except (httpx.HTTPError, RuntimeError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"수익률을 계산하지 못했습니다: {exc}") from exc

    start_key = request.start_date.strftime("%Y%m%d")
    timeline = {start_key}
    for prices in price_history.values():
        timeline.update(bar["date"] for bar in prices if bar["date"] >= start_key)
    ordered_timeline = sorted(timeline)
    stride = max(1, (len(ordered_timeline) + 599) // 600)
    sampled_timeline = ordered_timeline[::stride]
    if sampled_timeline[-1] != ordered_timeline[-1]:
        sampled_timeline.append(ordered_timeline[-1])
    index_series = []
    history_cursor = {identity: 0 for identity in price_history}
    buy_cursor = {identity: 0 for identity in buy_history}
    last_close: dict[str, float] = {}
    recurring_units: dict[str, float] = {identity: 0.0 for identity in buy_history}
    recurring_contributions: dict[str, float] = {identity: 0.0 for identity in buy_history}
    for day_key in sampled_timeline:
        current_value = 0.0
        contributed_amount = 0.0
        for position in request.positions:
            if position.target_weight <= 0:
                continue
            identity = f"{position.market}:{position.code}"
            bars = price_history.get(identity, [])
            if not bars:
                continue
            cursor = history_cursor[identity]
            while cursor < len(bars) and bars[cursor]["date"] <= day_key:
                last_close[identity] = bars[cursor]["close"]
                cursor += 1
            history_cursor[identity] = cursor
            current_close = last_close.get(identity)
            if request.mode == "once":
                allocation = position.target_weight / total_weight
                invested_on = buy_history[identity][0]
                contributed_amount += allocation
                current_value += allocation if day_key < invested_on["date"] or current_close is None else allocation * current_close / invested_on["close"]
            else:
                buys = buy_history.get(identity, [])
                cursor = buy_cursor[identity]
                while cursor < len(buys) and buys[cursor]["date"] <= day_key:
                    purchase = buys[cursor]
                    allocation = position.target_weight / total_weight
                    recurring_contributions[identity] += allocation
                    recurring_units[identity] += allocation / purchase["close"]
                    cursor += 1
                buy_cursor[identity] = cursor
                contributed_amount += recurring_contributions[identity]
                if current_close is not None:
                    current_value += recurring_units[identity] * current_close
        index_value = 100 * current_value / contributed_amount if contributed_amount else 100
        index_series.append({"date": day_key, "value": index_value})

    return {
        "mode": request.mode,
        "frequency": request.frequency if request.mode == "recurring" else None,
        "start_date": request.start_date.isoformat(),
        "end_date": today.isoformat(),
        "return_pct": weighted_return / total_weighted_contributions if total_weighted_contributions else None,
        "investment_amount": request.investment_amount if request.mode == "once" else None,
        "current_value": total_current_value if request.mode == "once" else None,
        "profit_amount": total_current_value - request.investment_amount if request.mode == "once" and request.investment_amount is not None else None,
        "index_series": index_series,
        "positions": simulated_positions,
    }

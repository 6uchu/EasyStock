"""Searchable security masters published by NAMUH PLUG."""

import asyncio
import time
from typing import Any

import httpx

MASTER_URLS = {
    "KR": ("https://www.nhplug.com/instruments/m_new_stock.mst", 237),
    "US": ("https://www.nhplug.com/instruments/m_gtsstock.mst", 164),
}
_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_cache_lock = asyncio.Lock()
_CACHE_TTL = 6 * 60 * 60


def _decode(raw: bytes) -> str:
    return raw.decode("cp949", errors="replace").strip()


def _parse_master(market: str, raw: bytes, record_size: int) -> list[dict[str, Any]]:
    if not raw or len(raw) % record_size:
        raise ValueError(f"{market} 종목 마스터 파일 크기가 올바르지 않습니다.")
    rows: list[dict[str, Any]] = []
    for start in range(0, len(raw), record_size):
        row = raw[start:start + record_size]
        if market == "KR":
            code = _decode(row[0:6])
            market_code = _decode(row[6:7])
            raw_name = _decode(row[7:48])
            name = raw_name.lstrip("*#").strip()
            english_name = _decode(row[48:89])
            # Domestic ETF codes can contain letters (for example, 0127R0 and
            # 0091C0); filtering to digits silently drops those listings.
            if len(code) != 6 or not code.isascii() or not code.isalnum() or not name:
                continue
            code = code.upper()
            rows.append({
                "code": code,
                "name": name,
                "english_name": english_name,
                "market": "KR",
                "currency": "KRW",
                "is_etf": market_code == "1" and _decode(row[165:166]) == "8",
                "price_hint": int(_decode(row[152:159]) or "0"),
            })
        else:
            name = _decode(row[15:55])
            english_name = _decode(row[55:95])
            country = _decode(row[95:98]).upper()
            symbol = _decode(row[98:110]).upper()
            currency = _decode(row[138:141]).upper()
            if country != "USA" or not symbol or not (name or english_name):
                continue
            rows.append({
                "code": symbol,
                "name": name or english_name,
                "english_name": english_name,
                "market": "US",
                "currency": currency or "USD",
                "is_etf": _decode(row[125:127]) == "12",
                "price_hint": 0,
            })
    return rows


async def _load_master(market: str) -> list[dict[str, Any]]:
    cached = _cache.get(market)
    if cached and cached[0] > time.monotonic():
        return cached[1]
    async with _cache_lock:
        cached = _cache.get(market)
        if cached and cached[0] > time.monotonic():
            return cached[1]
        url, record_size = MASTER_URLS[market]
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(url)
            response.raise_for_status()
        rows = _parse_master(market, response.content, record_size)
        _cache[market] = (time.monotonic() + _CACHE_TTL, rows)
        return rows


async def search_instruments(market: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
    rows = await _load_master(market)
    q = query.strip().casefold()
    if not q:
        return []

    def matches(row: dict[str, Any]) -> bool:
        return any(q in str(row[field]).casefold() for field in ("code", "name", "english_name"))

    found = [row for row in rows if matches(row)]
    found.sort(key=lambda row: (
        0 if str(row["code"]).casefold().startswith(q) else 1,
        0 if str(row["name"]).casefold().startswith(q) or str(row["english_name"]).casefold().startswith(q) else 1,
        str(row["name"]).casefold(),
    ))
    return found[:limit]

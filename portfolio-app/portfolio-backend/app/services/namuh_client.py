"""Small async client for the NAMUH PLUG auth, account list, and domestic balance APIs."""

import asyncio
from datetime import date
import time
from typing import Any

import httpx

from app.services.connection_store import get_credentials

BASE_URL = "https://api.nhplug.com:8443"


class NamuhClient:
    def __init__(self) -> None:
        self._tokens: dict[str, tuple[str, float]] = {}
        self._token_lock = asyncio.Lock()

    async def get_access_token(self, profile_id: str) -> str:
        """Issue a token when needed and reuse it until shortly before expiry."""
        cached = self._tokens.get(profile_id)
        if cached and cached[1] > time.monotonic() + 60:
            return cached[0]
        async with self._token_lock:
            cached = self._tokens.get(profile_id)
            if cached and cached[1] > time.monotonic() + 60:
                return cached[0]
            app_key, app_secret = get_credentials(profile_id)
            async with httpx.AsyncClient(base_url=BASE_URL, timeout=15) as client:
                response = await client.post(
                    "/oauth2/token",
                    params={
                        "appkey": app_key,
                        "appsecretkey": app_secret,
                        "grant_type": "client_credentials",
                        "scope": "oob",
                    },
                    headers={"content-type": "application/x-www-form-urlencoded"},
                )
                response.raise_for_status()
                token_data = response.json()

            token = token_data["access_token"]
            expires_at = time.monotonic() + int(token_data.get("expires_in", 86400))
            self._tokens[profile_id] = (token, expires_at)
            return token

    async def _post(self, profile_id: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        token = await self.get_access_token(profile_id)
        app_key, app_secret = get_credentials(profile_id)
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=20) as client:
            response = await client.post(
                path,
                json={"Input_0": payload},
                headers={
                    "Authorization": f"Bearer {token}",
                    "x-client-id": app_key,
                    "x-client-secret": app_secret,
                },
            )
            response.raise_for_status()
            result = response.json()

        if result.get("rsp_msg") and "Output_0" not in result and "Output_1" not in result:
            raise RuntimeError(f"NH API 응답: {result['rsp_msg']}")
        return result

    async def list_accounts(self, profile_id: str) -> list[dict[str, str]]:
        result = await self._post(profile_id, "/n2/acctinfo", {})
        accounts = result.get("Output_0") or []
        # This app currently targets the production NAMUH API. Never route a mock
        # account through the live host, and never silently pick the first account.
        return [
            {"account_no": str(row["acct_no"]), "account_type": str(row["acct_type"])}
            for row in accounts
            if str(row.get("acct_type")) in {"01", "02"} and row.get("acct_no")
        ]

    async def get_balance(self, profile_id: str, account_no: str) -> dict[str, Any]:
        result = await self._post(
            profile_id,
            "/krstock/inquiry/v1/balance",
            {
                "act_no": account_no,
                "bnc_bse_cd": "5",
                "ltg_aot_dit_cd": "9",
                "aet_bse": "2",
                "qut_dit_cd": "UNT",
                "aly_qut_cd": "1",
            },
        )
        summary = result.get("Output_0") or {}
        holdings = result.get("Output_1") or []
        return {"summary": summary, "holdings": holdings}

    async def search_instrument(self, profile_id: str, market: str, code: str) -> dict[str, Any]:
        """Resolve an exact domestic code or US ticker through NAMUH quote APIs."""
        if market == "KR":
            result = await self._post(profile_id, "/krstock/quote/v1/currentPrice", {"iem_cd": code, "market_cd": "UNT"})
            output = result.get("Output_0") or {}
            name = str(output.get("iem_nm") or "").strip()
            price = output.get("stck_prpr")
            currency = "KRW"
        elif market == "US":
            result = await self._post(profile_id, "/gbstock/quote/v1/current", {"iem_cd": code})
            output = result.get("Output_0") or {}
            name = str(output.get("iem_nm") or "").strip()
            price = output.get("trdprc")
            currency = "USD"
        else:
            raise ValueError("지원하지 않는 시장입니다.")

        if not name or price is None or float(price) <= 0:
            raise ValueError(str(result.get("rsp_msg") or "종목 코드로 조회된 시세 정보가 없습니다."))
        return {"code": code, "name": name, "price": float(price), "currency": currency, "market": market}

    async def get_daily_prices(self, profile_id: str, market: str, code: str, end_date: date) -> list[dict[str, Any]]:
        """Fetch daily close prices for a single equity from NAMUH PLUG."""
        if market == "KR":
            result = await self._post(profile_id, "/krstock/quote/v1/period", {
                "iem_cd": code,
                "market_cd": "KRX",
                "edate": end_date.strftime("%Y%m%d"),
                "array_cnt": "9999",
                "maxavg": "000",
                "gubun": "1",
                "xtick": "001",
                "today_cls_code": "0",
                "fake_tick": "1",
                "sur_flag": "0",
                "sur_gb_day_cnt": "00",
                "sur_bf_end_time": "000000",
                "out1_scale_change": "0",
                "out2_scale_change": "0",
                "view_main_yn": "Y",
            })
            rows = result.get("Output_1") or result.get("Output_0") or []
            date_key, price_key = "bsop_date", "stck_prpr"
        elif market == "US":
            result = await self._post(profile_id, "/gbstock/quote/v1/period", {
                "iem_cd": code,
                "end_dt": end_date.strftime("%Y%m%d"),
                "count": "9999",
                "maxavg": "000",
                "gubun": "3",
                "xtick": "0001",
                "today_cls": "0",
                "market_cls": "1",
            })
            rows = result.get("Output_0") or result.get("Output_1") or []
            date_key, price_key = "date", "trdprc"
        else:
            raise ValueError("지원하지 않는 시장입니다.")

        if not isinstance(rows, list):
            rows = []
        prices = []
        for row in rows:
            trade_date = str(row.get(date_key) or "")[:8]
            try:
                close = float(row.get(price_key) or 0)
            except (TypeError, ValueError):
                continue
            if len(trade_date) == 8 and close > 0:
                prices.append({"date": trade_date, "close": close})
        prices.sort(key=lambda item: item["date"])
        if not prices:
            raise ValueError(str(result.get("rsp_msg") or f"{code}의 과거 일별 시세가 없습니다."))
        return prices


namuh_client = NamuhClient()

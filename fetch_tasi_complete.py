"""
Fetch TASI (Tadawul) financial data from Twelve Data API.

Reads stocks from tasi_grouped_by_industry.json, fetches data for each,
and saves/overwrites tasi_all_financial_data.json (flat companies[] time-series).

The web client loads public/data/tasi_financial_data.json (Twelve-style industries +
statement trees); regenerate that file separately if the app should use this fetch output.

- Only keeps entries where value exists (removes null/empty)
- Retries fetch once if data returns null; if still null after retry, removes that entry
- Cleans all time-series arrays to exclude null values before saving

Usage: python fetch_tasi_complete.py [--fresh]
  --fresh  Ignore existing output and regenerate from scratch
"""

import json
import time
import sys
from pathlib import Path

import requests

API_KEY = "5da413057f75498490b0303582e0d0de"
BASE_URL = "https://api.twelvedata.com"
TASI_JSON_PATH = "public/data/tasi_grouped_by_industry.json"
OUTPUT_PATH = "public/data/tasi_all_financial_data.json"
DELAY_SECONDS = 1.5
FETCH_RETRIES = 2  # Retries per API call
COMPANY_RETRY_ON_NULL = 1  # Extra company fetch if we get null entries


TIME_SERIES_FIELDS = [
    "sales",
    "gross_profit",
    "operating_income",
    "net_income",
    "equity",
    "free_cash_flow",
]


def load_tasi_companies(path: str) -> list[dict]:
    """Load TASI companies from JSON, preserving order."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    companies = []
    for industry, items in data.items():
        for item in items:
            ticker = str(item["Ticker"]).strip()
            symbol = f"{ticker}:Tadawul"
            companies.append({
                "ticker": ticker,
                "company": item["Company"],
                "industry": industry,
                "symbol": symbol,
            })
    return companies


def fetch_endpoint(endpoint_name: str, symbol: str, retries: int = FETCH_RETRIES) -> dict:
    """Fetch from Twelve Data API. Retries on failure."""
    url = f"{BASE_URL}/{endpoint_name}"
    params = {"symbol": symbol, "apikey": API_KEY}
    for attempt in range(retries + 1):
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            if data.get("code") and data.get("code") >= 400:
                return {"error": data.get("message", "API error")}
            return data
        except Exception as e:
            if attempt < retries:
                time.sleep(DELAY_SECONDS * 2)
            else:
                return {"error": str(e)}


def fetch_company_data(symbol: str) -> dict:
    """Fetch all financial data for one company."""
    result = {
        "enterprise_value": None,
        "market_capitalization": None,
        "forward_pe": None,
        "price_to_sales_ttm": None,
        "outstanding_common_stocks": None,
        "sales": [],
        "gross_profit": [],
        "operating_income": [],
        "net_income": [],
        "equity": [],
        "free_cash_flow": [],
        "short_term_debt": None,
        "long_term_debt": None,
        "cash_and_cash_equivalents": None,
    }

    # 1. Statistics
    stats_data = fetch_endpoint("statistics", symbol)
    time.sleep(DELAY_SECONDS)
    if stats_data and "error" not in stats_data and "statistics" in stats_data:
        stats = stats_data["statistics"]
        if "valuations_metrics" in stats:
            vm = stats["valuations_metrics"]
            result["enterprise_value"] = vm.get("enterprise_value")
            result["market_capitalization"] = vm.get("market_capitalization")
            result["forward_pe"] = vm.get("forward_pe")
            result["price_to_sales_ttm"] = vm.get("price_to_sales_ttm")
        if "stock_statistics" in stats:
            result["outstanding_common_stocks"] = stats["stock_statistics"].get("shares_outstanding")
    elif stats_data and "error" in stats_data:
        result["_error"] = stats_data.get("error", "Unknown error")

    # 2. Income Statement
    inc_data = fetch_endpoint("income_statement", symbol)
    time.sleep(DELAY_SECONDS)
    if inc_data and "error" not in inc_data and "income_statement" in inc_data:
        for item in inc_data["income_statement"]:
            sales_val = item.get("sales") or item.get("revenue") or item.get("total_revenue") or item.get("net_sales")
            result["sales"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": sales_val})
            result["gross_profit"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": item.get("gross_profit")})
            result["operating_income"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": item.get("operating_income")})
            result["net_income"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": item.get("net_income")})

    # 3. Balance Sheet
    bal_data = fetch_endpoint("balance_sheet", symbol)
    time.sleep(DELAY_SECONDS)
    if bal_data and "error" not in bal_data and "balance_sheet" in bal_data:
        items = bal_data["balance_sheet"]
        for item in items:
            equity_val = None
            if "shareholders_equity" in item:
                equity_val = item["shareholders_equity"].get("total_shareholders_equity")
            result["equity"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": equity_val})
        if items:
            first = items[0]
            curr_liab = (first.get("liabilities") or {}).get("current_liabilities") or {}
            noncurr_liab = (first.get("liabilities") or {}).get("non_current_liabilities") or {}
            curr_assets = (first.get("assets") or {}).get("current_assets") or {}
            result["short_term_debt"] = curr_liab.get("short_term_debt") if isinstance(curr_liab, dict) else None
            result["long_term_debt"] = noncurr_liab.get("long_term_debt") if isinstance(noncurr_liab, dict) else None
            result["cash_and_cash_equivalents"] = (
                curr_assets.get("cash_and_cash_equivalents") or curr_assets.get("cash")
                if isinstance(curr_assets, dict)
                else None
            )

    # 4. Cash Flow
    cf_data = fetch_endpoint("cash_flow", symbol)
    time.sleep(DELAY_SECONDS)
    if cf_data and "error" not in cf_data and "cash_flow" in cf_data:
        for item in cf_data["cash_flow"]:
            fcf = None
            if "free_cash_flow" in item:
                fcf = item.get("free_cash_flow")
            else:
                op_cf = (item.get("operating_activities") or {}).get("operating_cash_flow") if isinstance(item.get("operating_activities"), dict) else None
                cap_ex = (item.get("investing_activities") or {}).get("capital_expenditures") if isinstance(item.get("investing_activities"), dict) else None
                if op_cf is not None and cap_ex is not None:
                    fcf = op_cf + cap_ex
            result["free_cash_flow"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": fcf})

    return result


def has_null_in_time_series(data: dict) -> bool:
    """Check if any time-series array has entries with null value."""
    for field in TIME_SERIES_FIELDS:
        arr = data.get(field) or []
        for item in arr:
            if item is not None and isinstance(item, dict) and "value" in item:
                if item["value"] is None:
                    return True
    return False


def clean_null_entries(data: dict) -> dict:
    """Remove any time-series entry where value is null. Only keep valid data."""
    result = dict(data)
    for field in TIME_SERIES_FIELDS:
        arr = result.get(field)
        if not isinstance(arr, list):
            continue
        result[field] = [
            item for item in arr
            if item is not None and isinstance(item, dict) and item.get("value") is not None
        ]
    return result


def main():
    script_dir = Path(__file__).parent
    tasi_path = script_dir / TASI_JSON_PATH
    out_path = script_dir / OUTPUT_PATH
    fresh = "--fresh" in sys.argv

    if not tasi_path.exists():
        print(f"Error: TASI file not found at {tasi_path}")
        return 1

    companies = load_tasi_companies(str(tasi_path))
    total = len(companies)
    print(f"Loaded {total} TASI companies from {TASI_JSON_PATH}\n")

    # Load existing output to overwrite (unless --fresh)
    out = None
    if not fresh and out_path.exists():
        try:
            with open(out_path, encoding="utf-8") as f:
                out = json.load(f)
            print(f"Loaded existing data from {OUTPUT_PATH} - will update in place.\n")
        except Exception as e:
            print(f"Could not load existing file: {e}")

    if out is None or "companies" not in out:
        out = {
            "meta": {"source": TASI_JSON_PATH, "total_companies": total, "currency": "SAR"},
            "companies": [],
        }

    # Build/ensure company list matches tasi_grouped_by_industry
    out["meta"]["total_companies"] = total
    out["meta"]["source"] = TASI_JSON_PATH

    # Ensure we have all companies in order
    if len(out["companies"]) != total:
        out["companies"] = [
            {
                "ticker": c["ticker"],
                "company": c["company"],
                "industry": c["industry"],
                "symbol": c["symbol"],
                "data": {},
            }
            for c in companies
        ]
    else:
        # Update meta, keep order
        for i, c in enumerate(companies):
            out["companies"][i]["ticker"] = c["ticker"]
            out["companies"][i]["company"] = c["company"]
            out["companies"][i]["industry"] = c["industry"]
            out["companies"][i]["symbol"] = c["symbol"]

    # Fetch each company, retry once on null, clean nulls, save
    for i, c in enumerate(companies):
        ticker = c["ticker"]
        print(f"[{i+1}/{total}] {ticker} ({c['company']}) - fetching...")
        data = fetch_company_data(c["symbol"])

        # Retry once if we got null entries in time-series
        if has_null_in_time_series(data) and COMPANY_RETRY_ON_NULL > 0:
            print(f"         -> nulls detected, retrying fetch...")
            time.sleep(DELAY_SECONDS * 2)
            data = fetch_company_data(c["symbol"])

        # Remove null entries from all time-series arrays
        data = clean_null_entries(data)
        # Drop internal error key if present
        data.pop("_error", None)

        out["companies"][i]["data"] = data

        # Save after each company (incremental save)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)

    print(f"\nDone. Saved {total} TASI companies to {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

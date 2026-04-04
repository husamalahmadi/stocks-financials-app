"""
Fill missing financial data in sp500_all_financial_data.json and tasi_all_financial_data.json
(flat companies[] bundles). The web client uses sp500_financial_data.json / tasi_financial_data.json
instead (different schema).

Identifies companies with empty time-series arrays or null scalars, re-fetches from Twelve Data API,
merges new data into existing, removes nulls, and saves.

Usage: python fill_missing_financial_data.py [sp500|tasi|all] [--limit N]
  sp500     Only fill S&P 500
  tasi      Only fill TASI
  all       Fill both (default)
  --limit N Limit to first N companies per file (for testing)
"""

import json
import time
import sys
from pathlib import Path

import requests

API_KEY = "5da413057f75498490b0303582e0d0de"
BASE_URL = "https://api.twelvedata.com"
DELAY_SECONDS = 1.5
FETCH_RETRIES = 2

TIME_SERIES_FIELDS = [
    "sales", "gross_profit", "operating_income", "net_income", "equity", "free_cash_flow"
]

CONFIGS = {
    "sp500": {
        "path": "public/data/sp500_all_financial_data.json",
        "symbol_key": "symbol",
        "name": "S&P 500",
    },
    "tasi": {
        "path": "public/data/tasi_all_financial_data.json",
        "symbol_key": "symbol",
        "name": "TASI",
    },
}


def fetch_endpoint(endpoint_name: str, symbol: str) -> dict:
    url = f"{BASE_URL}/{endpoint_name}"
    params = {"symbol": symbol, "apikey": API_KEY}
    for attempt in range(FETCH_RETRIES + 1):
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            if data.get("code") and data.get("code") >= 400:
                return {"error": data.get("message", "API error")}
            return data
        except Exception as e:
            if attempt < FETCH_RETRIES:
                time.sleep(DELAY_SECONDS * 2)
            else:
                return {"error": str(e)}


def fetch_company_data(symbol: str) -> dict:
    result = {
        "enterprise_value": None, "market_capitalization": None, "forward_pe": None,
        "price_to_sales_ttm": None, "outstanding_common_stocks": None,
        "sales": [], "gross_profit": [], "operating_income": [],
        "net_income": [], "equity": [], "free_cash_flow": [],
        "short_term_debt": None, "long_term_debt": None, "cash_and_cash_equivalents": None,
    }
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

    inc_data = fetch_endpoint("income_statement", symbol)
    time.sleep(DELAY_SECONDS)
    if inc_data and "error" not in inc_data and "income_statement" in inc_data:
        for item in inc_data["income_statement"]:
            sales_val = item.get("sales") or item.get("revenue") or item.get("total_revenue") or item.get("net_sales")
            result["sales"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": sales_val})
            result["gross_profit"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": item.get("gross_profit")})
            result["operating_income"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": item.get("operating_income")})
            result["net_income"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": item.get("net_income")})

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
                if isinstance(curr_assets, dict) else None
            )

    cf_data = fetch_endpoint("cash_flow", symbol)
    time.sleep(DELAY_SECONDS)
    if cf_data and "error" not in cf_data and "cash_flow" in cf_data:
        for item in cf_data["cash_flow"]:
            fcf = item.get("free_cash_flow")
            if fcf is None:
                op_cf = (item.get("operating_activities") or {}).get("operating_cash_flow") if isinstance(item.get("operating_activities"), dict) else None
                cap_ex = (item.get("investing_activities") or {}).get("capital_expenditures") if isinstance(item.get("investing_activities"), dict) else None
                if op_cf is not None and cap_ex is not None:
                    fcf = op_cf + cap_ex
            result["free_cash_flow"].append({"fiscal_date": item.get("fiscal_date"), "year": item.get("year"), "value": fcf})

    return result


def has_empty_arrays(data: dict) -> bool:
    """True if any time-series array is empty."""
    for field in TIME_SERIES_FIELDS:
        arr = data.get(field)
        if not isinstance(arr, list) or len(arr) == 0:
            return True
    return False


def has_null_scalars(data: dict) -> bool:
    """True if key scalar fields are null."""
    return (
        data.get("enterprise_value") is None
        or data.get("outstanding_common_stocks") is None
    )


def clean_null_entries(data: dict) -> dict:
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


SCALAR_FIELDS = [
    "enterprise_value", "market_capitalization", "forward_pe", "price_to_sales_ttm",
    "outstanding_common_stocks", "short_term_debt", "long_term_debt", "cash_and_cash_equivalents",
]


def merge_data(existing: dict, new: dict) -> dict:
    """Merge new data into existing. Fill empty arrays and null scalars."""
    result = dict(existing)
    for field in SCALAR_FIELDS:
        if result.get(field) is None and new.get(field) is not None:
            result[field] = new[field]
    for field in TIME_SERIES_FIELDS:
        existing_arr = result.get(field) or []
        new_arr = new.get(field) or []
        if not existing_arr and new_arr:
            result[field] = [x for x in new_arr if x.get("value") is not None]
        elif existing_arr and new_arr:
            existing_years = {x.get("year"): x for x in existing_arr if x.get("value") is not None}
            for item in new_arr:
                if item.get("value") is not None and item.get("year") not in existing_years:
                    existing_years[item["year"]] = item
            result[field] = list(existing_years.values())
    return result


def process_file(config: dict, script_dir: Path) -> int:
    path = script_dir / config["path"]
    if not path.exists():
        print(f"  File not found: {path}")
        return 0

    with open(path, encoding="utf-8") as f:
        out = json.load(f)

    companies = out.get("companies", [])
    to_fetch = []
    for i, c in enumerate(companies):
        data = c.get("data") or {}
        if has_empty_arrays(data) or has_null_scalars(data):
            to_fetch.append((i, c))

    if not to_fetch:
        print(f"  No companies with missing data.")
        return 0

    total_missing = len(to_fetch)
    limit = None
    if "--limit" in sys.argv:
        idx = sys.argv.index("--limit")
        if idx + 1 < len(sys.argv):
            try:
                limit = int(sys.argv[idx + 1])
                to_fetch = to_fetch[:limit]
                print(f"  Processing first {limit} of {total_missing} companies with missing data (--limit)...")
            except ValueError:
                print(f"  {total_missing} companies with missing data - re-fetching...")
        else:
            print(f"  {total_missing} companies with missing data - re-fetching...")
    else:
        print(f"  {total_missing} companies with missing data - re-fetching...")
    filled = 0
    for idx, (i, c) in enumerate(to_fetch):
        symbol = c.get("symbol") or (f"{c.get('ticker', '')}:Tadawul" if config["name"] == "TASI" else str(c.get("ticker", "")))
        print(f"    [{idx+1}/{len(to_fetch)}] {c.get('ticker')} - fetching...")
        new_data = fetch_company_data(symbol)
        merged = merge_data(c["data"], new_data)
        merged = clean_null_entries(merged)
        out["companies"][i]["data"] = merged
        if has_empty_arrays(merged):
            still_empty = sum(1 for f in TIME_SERIES_FIELDS if not (merged.get(f) or []))
            if still_empty < 6:
                filled += 1
        else:
            filled += 1

        with open(path, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)

    return filled


def main():
    script_dir = Path(__file__).parent
    target = (sys.argv[1] if len(sys.argv) > 1 else "all").lower()
    if target not in ("sp500", "tasi", "all"):
        target = "all"

    configs = [CONFIGS["sp500"], CONFIGS["tasi"]] if target == "all" else [CONFIGS[target]]

    print("\n=== Fill missing financial data ===\n")
    for config in configs:
        print(f"--- {config['name']} ---")
        process_file(config, script_dir)
    print("\n=== Done ===\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())

// FILE: client/src/services/financialsService.js
import { getCached, setCached, delCached } from "../cache/browserCache.js";
import { resolveMarketAndSymbol } from "../data/stocksCatalog.js";
import { mergeFinancials } from "../domain/financials.js";
import { twelveIncomeStatement, twelveBalanceSheet, twelveCashFlow } from "./twelveData.js";
import { getTasiCompanyData, isTasiBundleReady, tasiToFinancialsFormat } from "./tasiDataService.js";
import { getSp500CompanyData, sp500ToFinancialsFormat } from "./sp500DataService.js";

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Client-side replacement for GET /api/financials/:ticker.
 * - TASI (SA): uses local tasi_financial_data.json only (no Twelve statements/cash flow).
 * - US (S&P 500): uses local sp500_financial_data.json (no API).
 * - US falls back to Twelve Data API when local data is empty; SA never does.
 * - Only caches when years.length > 0 (same as server behavior).
 */
export async function getFinancialsCached({
  ticker,
  market,
  ttlMs = DAYS_30_MS,
  storage = "local", // "local" | "session"
} = {}) {
  const r = await resolveMarketAndSymbol(ticker, market);
  if (!r.ok) throw new Error("Ticker not allowed.");

  const cacheKey = `local_fin_${r.market}_${r.market === "us" ? r.tickerUS : r.tickerSA}`;

  const cached = getCached(cacheKey, { ttlMs, storage });
  if (cached) {
    const hasYears = Array.isArray(cached?.years) && cached.years.length > 0;
    if (!hasYears) {
      delCached(cacheKey, { storage });
    } else if (r.market === "sa" && !(await isTasiBundleReady())) {
      // Cached charts but live bundle failed (404 / bad JSON): drop cache so financials and valuation stay in sync.
      delCached(cacheKey, { storage });
    } else {
      return { source: "cache", ...cached };
    }
  }

  const warnings = [];
  let income = null;
  let balance = null;
  let cash = null;

  if (r.market === "sa") {
    const tasiData = await getTasiCompanyData(r.tickerSA);
    if (tasiData) {
      const { income: i, balance: b, cash: c } = tasiToFinancialsFormat(tasiData);
      income = i;
      balance = b;
      cash = c;
    }
  } else if (r.market === "us") {
    const sp500Data = await getSp500CompanyData(r.tickerUS);
    if (sp500Data) {
      const { income: i, balance: b, cash: c } = sp500ToFinancialsFormat(sp500Data);
      income = i;
      balance = b;
      cash = c;
    }
  }

  if (r.market !== "sa" && !income?.length && !balance?.length && !cash?.length) {
    const symbol = r.symbol;
    [income, balance, cash] = await Promise.all([
      twelveIncomeStatement(symbol, { period: "annual" }).catch((e) => {
        warnings.push(`income_statement: ${e.message}`);
        return null;
      }),
      twelveBalanceSheet(symbol, { period: "annual" }).catch((e) => {
        warnings.push(`balance_sheet: ${e.message}`);
        return null;
      }),
      twelveCashFlow(symbol, { period: "annual" }).catch((e) => {
        warnings.push(`cash_flow: ${e.message}`);
        return null;
      }),
    ]);
  }

  const merged = mergeFinancials({
    income,
    balance,
    cash,
    ticker: r.market === "us" ? r.tickerUS : r.tickerSA,
    warnings,
  });

  const payload = { market: r.market, ...merged };

  const hasYears = Array.isArray(payload.years) && payload.years.length > 0;
  if (hasYears) {
    setCached(cacheKey, payload, { storage });
    const src = r.market === "sa" ? "tasi" : r.market === "us" ? "sp500" : "live";
    return { source: src, ...payload };
  }

  delCached(cacheKey, { storage });
  return { source: "live-empty", ...payload };
}
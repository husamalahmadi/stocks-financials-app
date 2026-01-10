// FILE: client/src/services/financialsService.js
import { getCached, setCached, delCached } from "../cache/browserCache.js";
import { resolveMarketAndSymbol } from "../data/stocksCatalog.js";
import { mergeFinancials } from "../domain/financials.js";
import { twelveIncomeStatement, twelveBalanceSheet, twelveCashFlow } from "./twelveData.js";

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Client-side replacement for GET /api/financials/:ticker.
 * - Uses localStorage TTL (30 days) to match the old server disk cache.
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
    if (hasYears) return { source: "cache", ...cached };
    delCached(cacheKey, { storage });
  }

  const warnings = [];
  const symbol = r.symbol;

  const [income, balance, cash] = await Promise.all([
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
    return { source: "live", ...payload };
  }

  delCached(cacheKey, { storage });
  return { source: "live-empty", ...payload };
}
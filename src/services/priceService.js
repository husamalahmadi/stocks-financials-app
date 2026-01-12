// FILE: client/src/services/priceService.js
import { resolveMarketAndSymbol } from "../data/stocksCatalog.js";
import { toNumber } from "../domain/financials.js";
import { twelvePrice } from "./twelveData.js";

/**
 * Client-side replacement for GET /api/price/:ticker
 */
export async function getLivePrice({ ticker, market } = {}) {
  const r = await resolveMarketAndSymbol(ticker, market);
  if (!r.ok) throw new Error("Ticker not allowed.");

  const { symbol, currency, market: resolvedMarket, tickerUS, tickerSA } = r;
  const j = await twelvePrice(symbol);
  const price = toNumber(j?.price) ?? 0;

  return {
    source: "live",
    ticker: resolvedMarket === "us" ? tickerUS : tickerSA,
    market: resolvedMarket,
    price: Number.isFinite(price) ? price : 0,
    currency,
    fetchedAt: new Date().toISOString(),
  };
}
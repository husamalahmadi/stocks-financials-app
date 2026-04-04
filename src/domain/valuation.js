// FILE: client/src/domain/valuation.js
import { resolveMarketAndSymbol, CURRENCY_BY_MARKET } from "../data/stocksCatalog.js";
import { coalesce, toNumber } from "./financials.js";
import {
  twelvePrice,
  twelveStatistics,
  twelveBalanceSheet,
  twelveIncomeStatement,
} from "../services/twelveData.js";
import { getTasiCompanyData, tasiToValuationFormat } from "../services/tasiDataService.js";
import { getSp500CompanyData, sp500ToValuationFormat } from "../services/sp500DataService.js";

/** Prefer latest fiscal period (Twelve annual rows are usually newest-first, but not guaranteed). */
function latestStatementRow(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return {};
  const sorted = [...rows].sort((a, b) =>
    String(b?.fiscal_date || "").localeCompare(String(a?.fiscal_date || ""))
  );
  return sorted[0] || {};
}

/**
 * Twelve payloads sometimes nest metrics under .statistics twice (API) or once (local file inner node).
 */
function normalizeValuationStats(raw) {
  if (!raw || typeof raw !== "object") return {};
  if (raw.valuations_metrics != null || raw.stock_statistics != null) return raw;
  if (raw.statistics && typeof raw.statistics === "object") {
    return normalizeValuationStats(raw.statistics);
  }
  return raw;
}

/**
 * Client-side replacement for GET /api/valuation/:ticker.
 * - TASI (SA): same pipeline as US — getTasiCompanyData from tasi_financial_data.json → tasiToValuationFormat (localJsonToValuationFormat).
 * - US (S&P 500): getSp500CompanyData from sp500_financial_data.json → sp500ToValuationFormat; optional Twelve fallback; twelvePrice for quote.
 */
export async function computeValuation({ ticker, market } = {}) {
  const r = await resolveMarketAndSymbol(ticker, market);
  if (!r.ok) throw new Error("Ticker not allowed.");

  const { market: resolvedMarket, symbol, tickerUS, tickerSA } = r;

  let statsJson = {};
  let bsJson = {};
  let isJson = {};

  if (resolvedMarket === "sa") {
    try {
      const tasiData = await getTasiCompanyData(tickerSA);
      if (tasiData) {
        const v = tasiToValuationFormat(tasiData);
        if (v) {
          statsJson = { statistics: v.stats };
          bsJson = { balance_sheet: v.balance_sheet };
          isJson = { income_statement: v.income_statement };
        }
      }
    } catch {
      /* no local TASI bundle */
    }
  } else if (resolvedMarket === "us") {
    try {
      const sp500Data = await getSp500CompanyData(tickerUS);
      if (sp500Data) {
        const v = sp500ToValuationFormat(sp500Data);
        if (v) {
          statsJson = { statistics: v.stats };
          bsJson = { balance_sheet: v.balance_sheet };
          isJson = { income_statement: v.income_statement };
        }
      }
    } catch {
      /* fall through to Twelve Data */
    }
  }

  if (resolvedMarket === "us" && !statsJson?.statistics && !bsJson?.balance_sheet) {
    [statsJson, bsJson, isJson] = await Promise.all([
      twelveStatistics(symbol).catch(() => ({})),
      twelveBalanceSheet(symbol).catch(() => ({})),
      twelveIncomeStatement(symbol).catch(() => ({})),
    ]);
  }

  const priceJson = await twelvePrice(symbol).catch(() => ({}));

  const stats = normalizeValuationStats(statsJson?.statistics || statsJson || {});
  const price = toNumber(priceJson?.price) ?? 0;

  const bs0 =
    Array.isArray(bsJson?.balance_sheet)
      ? latestStatementRow(bsJson.balance_sheet)
      : Array.isArray(bsJson?.balance_sheet?.annual)
        ? latestStatementRow(bsJson.balance_sheet.annual)
        : bsJson?.balance_sheet || {};

  const is0 =
    Array.isArray(isJson?.income_statement)
      ? latestStatementRow(isJson.income_statement)
      : Array.isArray(isJson?.income_statement?.annual)
        ? latestStatementRow(isJson.income_statement.annual)
        : isJson?.income_statement || {};

  let sharesOutstanding = Math.max(
    0,
    coalesce(
      stats?.stock_statistics?.shares_outstanding,
      stats?.stock_statistics?.shares_outstanding_5y_avg,
      stats?.shares_outstanding
    )
  );

  if (sharesOutstanding <= 0 && Array.isArray(isJson?.income_statement)) {
    const rows = [...isJson.income_statement].sort((a, b) =>
      String(b?.fiscal_date || "").localeCompare(String(a?.fiscal_date || ""))
    );
    for (const row of rows) {
      const sh = coalesce(row?.basic_shares_outstanding, row?.diluted_shares_outstanding);
      if (sh > 0) {
        sharesOutstanding = sh;
        break;
      }
    }
  }

  const evFromStats = coalesce(
    stats?.valuations_metrics?.enterprise_value,
    stats?.valuation?.enterprise_value,
    stats?.enterprise_value
  );

  const longTermDebt = coalesce(
    bs0?.liabilities?.non_current_liabilities?.long_term_debt,
    stats?.financials?.long_term_debt
  );

  const shortTermDebt = coalesce(
    bs0?.liabilities?.current_liabilities?.short_term_debt,
    stats?.financials?.short_term_debt
  );

  const totalDebtApprox = longTermDebt + shortTermDebt;

  const cashEq = coalesce(
    bs0?.assets?.current_assets?.cash_and_cash_equivalents,
    bs0?.assets?.current_assets?.cash,
    stats?.financials?.cash_and_cash_equivalents
  );

  const marketCap = coalesce(
    stats?.valuations_metrics?.market_capitalization,
    stats?.market_cap,
    stats?.valuation?.market_cap
  );

  const enterpriseValue = evFromStats || Math.max(0, marketCap + totalDebtApprox - cashEq);

  const forwardPE = coalesce(stats?.valuations_metrics?.forward_pe);
  const netIncome = coalesce(is0?.net_income, is0?.net_income_loss);
  const priceToSales = coalesce(stats?.valuations_metrics?.price_to_sales_ttm);
  const sales = coalesce(is0?.sales, is0?.revenue, is0?.total_revenue);

  const totalEquityRaw =
    bs0?.shareholders_equity?.total_shareholders_equity ??
    bs0?.total_shareholders_equity ??
    bs0?.shareholders_equity?.total_equity;

  const totalEquity = coalesce(totalEquityRaw);
  const equityPerShare = sharesOutstanding > 0 ? totalEquity / sharesOutstanding : 0;

  let fairEV = 0;
  let fairPE = 0;
  let fairPS = 0;

  if (sharesOutstanding > 0) {
    fairEV = (enterpriseValue - longTermDebt + cashEq) / sharesOutstanding;
    fairPE = (forwardPE * netIncome) / sharesOutstanding;
    fairPS = (priceToSales * sales) / sharesOutstanding;
  }

  const currency = CURRENCY_BY_MARKET[resolvedMarket] || (resolvedMarket === "sa" ? "SAR" : "USD");

  return {
    source: "live",
    ticker: resolvedMarket === "us" ? tickerUS : tickerSA,
    market: resolvedMarket,
    fetchedAt: new Date().toISOString(),
    currency,
    price: Number.isFinite(price) ? price : 0,
    fairEV: Number.isFinite(fairEV) ? fairEV : 0,
    fairPE: Number.isFinite(fairPE) ? fairPE : 0,
    fairPS: Number.isFinite(fairPS) ? fairPS : 0,
    equityPerShare: Number.isFinite(equityPerShare) ? equityPerShare : 0,
  };
}

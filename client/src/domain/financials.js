// FILE: client/src/domain/financials.js
/**
 * Server financial-statement merging logic ported to the client.
 */

export const normKey = (k) => k.toLowerCase().replace(/[^a-z]/g, "");

export function toNumber(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || s === "—" || /^na$/i.test(s) || /^null$/i.test(s) || s === "-") return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export const coalesce = (...vals) => {
  for (const v of vals) {
    const n = toNumber(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

export function unwrapArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  for (const k of ["data", "values", "income_statements", "balance_sheet", "cash_flow"]) {
    if (Array.isArray(payload?.[k])) return payload[k];
  }
  for (const v of Object.values(payload || {})) if (Array.isArray(v)) return v;
  return [];
}

export function yearFrom(row) {
  const y =
    row?.fiscal_year ??
    row?.fiscalYear ??
    row?.year ??
    row?.date ??
    row?.period ??
    row?.calendarYear ??
    row?.fiscalDateEnding ??
    row?.fiscal_date;
  const m = y ? String(y).match(/\b(19|20)\d{2}\b/) : null;
  return m ? m[0] : null;
}

/**
 * Try hard to extract "total shareholders equity" from nested shapes.
 */
export function findEquity(row) {
  const seen = new Set();

  function dfs(node) {
    if (!node || typeof node !== "object" || seen.has(node)) return undefined;
    seen.add(node);

    for (const [k, v] of Object.entries(node)) {
      if (normKey(k) === "totalshareholdersequity") return v;
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === "object") {
        const r = dfs(v);
        if (r !== undefined) return r;
      }
    }
    return undefined;
  }

  const nested = dfs(row);
  if (nested !== undefined) return toNumber(nested);

  const key = Object.keys(row || {}).find((k) => normKey(k) === "shareholdersequity");
  if (!key) return null;

  const val = row[key];

  const n = toNumber(val);
  if (n != null) return n;

  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      const inner = findEquity(parsed);
      if (inner != null) return inner;
    } catch {
      // ignore
    }
  }
  if (val && typeof val === "object") {
    const inner = findEquity(val);
    if (inner != null) return inner;
  }
  return null;
}

/**
 * Produces:
 * { ticker, fetchedAt, years:[{year,revenue,operatingIncome,netIncome,totalEquity,freeCashFlow}], warnings }
 */
export function mergeFinancials({ income, balance, cash, ticker, warnings }) {
  const byYear = new Map();
  const ensure = (yr) => {
    if (!byYear.has(yr)) byYear.set(yr, { year: yr });
    return byYear.get(yr);
  };

  for (const row of unwrapArray(income)) {
    const yr = yearFrom(row);
    if (!yr) continue;
    const y = ensure(yr);
    y.revenue = coalesce(row?.total_revenue, row?.revenue, row?.net_sales, row?.sales, row?.total_sales);
    y.operatingIncome = coalesce(
      row?.operating_income,
      row?.operatingIncome,
      row?.operating_income_loss,
      row?.operating_profit
    );
    y.netIncome = coalesce(
      row?.net_income,
      row?.netIncome,
      row?.net_income_loss,
      row?.net_income_applicable_to_common_shares
    );
  }

  for (const row of unwrapArray(balance)) {
    const yr = yearFrom(row);
    if (!yr) continue;
    const y = ensure(yr);
    const equity = findEquity(row);
    if (equity == null) warnings.push(`balance_sheet ${yr}: cannot extract total_shareholders_equity`);
    else y.totalEquity = equity;
  }

  for (const row of unwrapArray(cash)) {
    const yr = yearFrom(row);
    if (!yr) continue;
    const y = ensure(yr);
    const fcfDirect = toNumber(row?.free_cash_flow ?? row?.free_cash_flow_ttm);
    const ocf = coalesce(row?.operating_cash_flow, row?.net_cash_provided_by_operating_activities);
    const capex = coalesce(row?.capital_expenditures, row?.capex);
    y.freeCashFlow = Number.isFinite(fcfDirect) && fcfDirect !== 0 ? fcfDirect : ocf - Math.abs(capex);
  }

  return {
    ticker,
    fetchedAt: new Date().toISOString(),
    years: [...byYear.values()]
      .filter(
        (r) =>
          r.year &&
          (r.revenue != null ||
            r.operatingIncome != null ||
            r.netIncome != null ||
            r.totalEquity != null ||
            r.freeCashFlow != null)
      )
      .sort((a, b) => Number(a.year) - Number(b.year)),
    warnings,
  };
}
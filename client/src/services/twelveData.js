// FILE: client/src/services/twelveData.js
/**
 * TwelveData browser client.
 * Note: API key is public in a client-only app.
 */

const BASE = "https://api.twelvedata.com";

function apiKey() {
  const k = (import.meta.env.VITE_TWELVEDATA_API_KEY || "").trim();
  if (!k) throw new Error("Missing VITE_TWELVEDATA_API_KEY in client/.env");
  return k;
}

async function fetchJson(url, { cache = "no-store" } = {}) {
  const res = await fetch(url, { cache });
  const txt = await res.text();
  let json = {};
  try {
    json = txt ? JSON.parse(txt) : {};
  } catch {
    throw new Error(`Bad JSON ${res.status}: ${txt?.slice(0, 150)}`);
  }
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  return json;
}

function buildUrl(pathname, params) {
  const u = new URL(BASE + pathname);
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null || v === "") continue;
    sp.set(k, String(v));
  }
  sp.set("apikey", apiKey());
  u.search = sp.toString();
  return u.toString();
}

export async function twelvePrice(symbol) {
  const url = buildUrl("/price", { symbol });
  return fetchJson(url, { cache: "no-store" });
}

export async function twelveStatistics(symbol) {
  const url = buildUrl("/statistics", { symbol });
  return fetchJson(url, { cache: "no-store" });
}

export async function twelveIncomeStatement(symbol, { period = "annual" } = {}) {
  const url = buildUrl("/income_statement", { symbol, period });
  return fetchJson(url, { cache: "no-store" });
}

export async function twelveBalanceSheet(symbol, { period = "annual" } = {}) {
  const url = buildUrl("/balance_sheet", { symbol, period });
  return fetchJson(url, { cache: "no-store" });
}

export async function twelveCashFlow(symbol, { period = "annual" } = {}) {
  const url = buildUrl("/cash_flow", { symbol, period });
  return fetchJson(url, { cache: "no-store" });
}
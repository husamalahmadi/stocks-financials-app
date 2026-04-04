// FILE: src/data/stocksCatalog.js
import { publicUrl } from "../utils/publicUrl.js";

const DATA_FILES = {
  us: publicUrl("data/sp500_grouped_by_industry.json"),
  sa: publicUrl("data/tasi_grouped_by_industry.json"),
};

export const CURRENCY_BY_MARKET = { us: "USD", sa: "SAR" };

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
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

function normalizeGrouped(grouped, { tickerUppercase, market }) {
  const flat = [];
  const inds = [];

  for (const [industry, items] of Object.entries(grouped || {})) {
    inds.push(industry);
    for (const it of items || []) {
      const rawTicker = String(it?.Ticker ?? it?.ticker ?? "").trim();
      const ticker = tickerUppercase ? rawTicker.toUpperCase() : rawTicker;
      const name = String(it?.Company ?? it?.name ?? "").trim();
      if (!ticker || !name) continue;
      flat.push({ ticker, name, industry, market });
    }
  }

  flat.sort((a, b) => a.ticker.toString().localeCompare(b.ticker.toString()));
  inds.sort((a, b) => a.localeCompare(b));

  const byUpperTicker = new Map();
  const upperSet = new Set();
  for (const it of flat) {
    const up = String(it.ticker).toUpperCase();
    byUpperTicker.set(up, it);
    upperSet.add(up);
  }

  return { list: flat, inds, byUpperTicker, upperSet };
}

let _catalogPromise = null;
async function ensureCatalog() {
  if (_catalogPromise) return _catalogPromise;

  _catalogPromise = (async () => {
    const [usRaw, saRaw] = await Promise.all([fetchJson(DATA_FILES.us), fetchJson(DATA_FILES.sa)]);

    const us = normalizeGrouped(usRaw, { tickerUppercase: true, market: "us" });
    const sa = normalizeGrouped(saRaw, { tickerUppercase: false, market: "sa" });

    return { us, sa };
  })();

  return _catalogPromise;
}

export async function getStocks({ market = "us" } = {}) {
  const cat = await ensureCatalog();
  const m = market === "sa" ? "sa" : "us";
  const pool = m === "sa" ? cat.sa : cat.us;

  return {
    market: m,
    count: pool.list.length,
    industries: pool.inds,
    items: pool.list,
  };
}

/** Returns all stocks from both US and TASI for unified search. */
export async function getAllStocks() {
  const cat = await ensureCatalog();
  const combined = [...cat.us.list, ...cat.sa.list];
  const industries = Array.from(new Set([...cat.us.inds, ...cat.sa.inds])).sort((a, b) => a.localeCompare(b));
  return { items: combined, industries };
}

export async function getCompany(rawTicker) {
  const cat = await ensureCatalog();
  const up = String(rawTicker || "").toUpperCase();

  const hitUS = cat.us.byUpperTicker.get(up);
  if (hitUS) {
    return {
      ticker: hitUS.ticker,
      name: hitUS.name,
      market: "us",
      currency: CURRENCY_BY_MARKET.us,
    };
  }

  const hitSA = cat.sa.byUpperTicker.get(up);
  if (hitSA) {
    return {
      ticker: hitSA.ticker,
      name: hitSA.name,
      market: "sa",
      currency: CURRENCY_BY_MARKET.sa,
    };
  }

  throw new Error("Ticker not found in US/SA lists.");
}

export async function resolveMarketAndSymbol(rawTicker, requestedMarket) {
  const cat = await ensureCatalog();

  const tickerUS = String(rawTicker || "").trim().toUpperCase();
  const tickerSA = String(rawTicker || "").trim();

  const inUS = cat.us.upperSet.has(tickerUS);
  const inSA = cat.sa.upperSet.has(tickerSA.toUpperCase());

  // Do not trust requestedMarket alone: Stock page defaults to "us" before catalog resolves,
  // which would mis-classify TASI tickers as US and break symbol (missing :TADAWUL) and local JSON lookup.
  let market = null;
  if (requestedMarket === "us" && inUS) market = "us";
  else if (requestedMarket === "sa" && inSA) market = "sa";

  if (!market) {
    if (inUS) market = "us";
    else if (inSA) market = "sa";
  }
  if (!market) return { ok: false };

  const symbol = market === "us" ? tickerUS : `${tickerSA}:TADAWUL`;
  const currency = CURRENCY_BY_MARKET[market];

  return { ok: true, market, symbol, tickerUS, tickerSA, currency };
}

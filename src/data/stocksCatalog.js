// FILE: client/src/data/stocksCatalog.js
const DATA_FILES = {
  us: "/data/sp500_grouped_by_industry.json",
  sa: "/data/tasi_grouped_by_industry.json",
};

export const CURRENCY_BY_MARKET = { us: "USD", sa: "SAR" };

async function fetchJson(url) {
  const res = await fetch(url);
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
    const [usRaw, saRaw] = await Promise.all([
      fetchJson(DATA_FILES.us),
      fetchJson(DATA_FILES.sa),
    ]);

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

  const tickerUS = String(rawTicker || "").toUpperCase();
  const tickerSA = String(rawTicker || "");

  let market =
    requestedMarket === "sa" ? "sa" : requestedMarket === "us" ? "us" : null;

  if (!market) {
    if (cat.us.upperSet.has(tickerUS)) market = "us";
    else if (cat.sa.upperSet.has(tickerSA.toUpperCase())) market = "sa";
  }
  if (!market) return { ok: false };

  const symbol = market === "us" ? tickerUS : `${tickerSA}:TADAWUL`;
  const currency = CURRENCY_BY_MARKET[market];

  return { ok: true, market, symbol, tickerUS, tickerSA, currency };
}

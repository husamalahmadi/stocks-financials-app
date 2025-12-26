// FILE: server/src/index.js
// Server for US/SA stocks. Price/valuation are NEVER saved (no-store).
// Financial statements are cached for 30 days, but ONLY when data is meaningful (years>0).

import express from "express";
import cors from "cors";
import morgan from "morgan";
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ---------------- Paths (relative to this file) ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR  = path.resolve(__dirname, "..", "data");
const CACHE_DIR = path.join(DATA_DIR, "cache");
const US_FILE   = path.join(DATA_DIR, "sp500_grouped_by_industry.json");
const SA_FILE   = path.join(DATA_DIR, "tasi_grouped_by_industry.json");

/* ---------------- App ---------------- */
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const PORT = process.env.PORT || 5175;
const BASE = "https://api.twelvedata.com";
const API_KEY = process.env.TWELVEDATA_API_KEY || "5da413057f75498490b0303582e0d0de";

const CACHE_TTL_DAYS = Number(process.env.CACHE_TTL_DAYS || 30); // statements only
const CURRENCY_BY_MARKET = { us: "USD", sa: "SAR" };

/* ---------------- Util: HTTP JSON ---------------- */
async function fetchJson(url) {
  const res = await fetch(url);
  const txt = await res.text();
  let json = {};
  try { json = txt ? JSON.parse(txt) : {}; } catch { throw new Error(`Bad JSON ${res.status}: ${txt?.slice(0,150)}`); }
  if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  return json;
}

/* ---------------- Util: numbers & shapes ---------------- */
const normKey = (k) => k.toLowerCase().replace(/[^a-z]/g, "");
function toNumber(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || s === "—" || /^na$/i.test(s) || /^null$/i.test(s) || s === "-") return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}
const coalesce = (...vals) => { for (const v of vals) { const n = toNumber(v); if (Number.isFinite(n)) return n; } return 0; };

function unwrapArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  for (const k of ["data","values","income_statements","balance_sheet","cash_flow"]) {
    if (Array.isArray(payload?.[k])) return payload[k];
  }
  for (const v of Object.values(payload || {})) if (Array.isArray(v)) return v;
  return [];
}
function yearFrom(row) {
  const y = row?.fiscal_year ?? row?.fiscalYear ?? row?.year ?? row?.date ?? row?.period ?? row?.calendarYear ?? row?.fiscalDateEnding ?? row?.fiscal_date;
  const m = y ? String(y).match(/\b(19|20)\d{2}\b/) : null;
  return m ? m[0] : null;
}

/* ---------------- Equity extractor (strict, nested) ---------------- */
function findEquity(row) {
  const seen = new Set();
  function dfs(node) {
    if (!node || typeof node !== "object" || seen.has(node)) return undefined;
    seen.add(node);
    for (const [k, v] of Object.entries(node)) {
      if (normKey(k) === "totalshareholdersequity") return v;
    }
    for (const v of Object.values(node)) if (v && typeof v === "object") {
      const r = dfs(v); if (r !== undefined) return r;
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
    try { const parsed = JSON.parse(val); const inner = findEquity(parsed); if (inner != null) return inner; } catch {}
  }
  if (val && typeof val === "object") {
    const inner = findEquity(val);
    if (inner != null) return inner;
  }
  return null;
}

/* ---------------- Merge financials ---------------- */
function mergeFinancials({ income, balance, cash, ticker, warnings }) {
  const byYear = new Map();
  const ensure = (yr) => { if (!byYear.has(yr)) byYear.set(yr, { year: yr }); return byYear.get(yr); };

  for (const row of unwrapArray(income)) {
    const yr = yearFrom(row); if (!yr) continue;
    const y = ensure(yr);
    y.revenue         = coalesce(row?.total_revenue, row?.revenue, row?.net_sales, row?.sales, row?.total_sales);
    y.operatingIncome = coalesce(row?.operating_income, row?.operatingIncome, row?.operating_income_loss, row?.operating_profit);
    y.netIncome       = coalesce(row?.net_income, row?.netIncome, row?.net_income_loss, row?.net_income_applicable_to_common_shares);
  }

  for (const row of unwrapArray(balance)) {
    const yr = yearFrom(row); if (!yr) continue;
    const y = ensure(yr);
    const equity = findEquity(row);
    if (equity == null) warnings.push(`balance_sheet ${yr}: cannot extract total_shareholders_equity`);
    else y.totalEquity = equity;
  }

  for (const row of unwrapArray(cash)) {
    const yr = yearFrom(row); if (!yr) continue;
    const y = ensure(yr);
    const fcfDirect = toNumber(row?.free_cash_flow ?? row?.free_cash_flow_ttm);
    const ocf = coalesce(row?.operating_cash_flow, row?.net_cash_provided_by_operating_activities);
    const capex = coalesce(row?.capital_expenditures, row?.capex);
    y.freeCashFlow = Number.isFinite(fcfDirect) && fcfDirect !== 0 ? fcfDirect : (ocf - Math.abs(capex));
  }

  return {
    ticker,
    fetchedAt: new Date().toISOString(),
    years: [...byYear.values()]
      .filter(r => r.year && (r.revenue!=null || r.operatingIncome!=null || r.netIncome!=null || r.totalEquity!=null || r.freeCashFlow!=null))
      .sort((a,b)=>Number(a.year)-Number(b.year)),
    warnings
  };
}

/* ---------------- Load lists (US + SA) ---------------- */
async function loadGrouped(filePath, picker) {
  const raw = JSON.parse(await fs.readFile(filePath, "utf8"));
  const flat = [];
  const inds = [];
  for (const [industry, items] of Object.entries(raw || {})) {
    inds.push(industry);
    for (const it of items || []) {
      const { ticker, name } = picker(it);
      if (!ticker || !name) continue;
      flat.push({ ticker, name, industry });
    }
  }
  return { list: flat.sort((a,b)=>a.ticker.toString().localeCompare(b.ticker.toString())), inds: inds.sort() };
}

if (!fssync.existsSync(DATA_DIR))  fssync.mkdirSync(DATA_DIR,  { recursive: true });
if (!fssync.existsSync(CACHE_DIR)) fssync.mkdirSync(CACHE_DIR, { recursive: true });

let US = { list: [], inds: [] };
let SA = { list: [], inds: [] };

if (fssync.existsSync(US_FILE)) {
  US = await loadGrouped(US_FILE, it => ({
    ticker: String(it.Ticker ?? it.ticker ?? "").toUpperCase().trim(),
    name: String(it.Company ?? it.name ?? "").trim()
  }));
} else {
  console.warn(`US list not found: ${US_FILE}`);
}
if (fssync.existsSync(SA_FILE)) {
  SA = await loadGrouped(SA_FILE, it => ({
    ticker: String(it.Ticker ?? it.ticker ?? "").trim(),
    name: String(it.Company ?? it.name ?? "").trim()
  }));
} else {
  console.warn(`SA list not found: ${SA_FILE}`);
}

const US_SET = new Set(US.list.map(x => x.ticker.toUpperCase()));
const SA_SET = new Set(SA.list.map(x => x.ticker.toUpperCase()));

/* ---------------- Statement cache helpers (disk) ---------------- */
function cachePath(market, ticker) { return path.join(CACHE_DIR, `${market}_${ticker}.json`); }
async function readCache(filePath, ttlDays) {
  try {
    const stat = await fs.stat(filePath);
    const ageMs = Date.now() - stat.mtimeMs;
    const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
    if (ageMs <= ttlMs) {
      const json = JSON.parse(await fs.readFile(filePath, "utf8"));
      return { ok: true, data: json, mtime: stat.mtime };
    }
    return { ok: false, reason: "stale" };
  } catch {
    return { ok: false, reason: "missing" };
  }
}
async function writeCache(filePath, payload) {
  try { await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8"); } catch {}
}

/* ---------------- Market resolver ---------------- */
function resolveMarketAndSymbol(rawTicker, requestedMarket) {
  const tickerUS = String(rawTicker || "").toUpperCase();
  const tickerSA = String(rawTicker || "");
  let market = requestedMarket === "sa" ? "sa" : requestedMarket === "us" ? "us" : null;
  if (!market) {
    if (US_SET.has(tickerUS)) market = "us";
    else if (SA_SET.has(tickerSA.toUpperCase())) market = "sa";
  }
  if (!market) return { ok: false };
  const symbol = market === "us" ? tickerUS : `${tickerSA}:TADAWUL`;
  const currency = CURRENCY_BY_MARKET[market];
  return { ok: true, market, symbol, tickerUS, tickerSA, currency };
}

/* ---------------- Routes ---------------- */

// List stocks (market-aware)
app.get("/api/stocks", (req, res) => {
  const market = (req.query.market || "us").toString().toLowerCase(); // us|sa
  const q = String(req.query.q || "").trim().toLowerCase();
  const ind = String(req.query.industry || "").trim().toLowerCase();

  const pool = market === "sa" ? SA : US;
  let items = pool.list;
  if (ind) items = items.filter(r => r.industry.toLowerCase() === ind);
  if (q) items = items.filter(r => r.ticker.toString().toLowerCase().includes(q) || r.name.toLowerCase().includes(q));

  res.json({ market, count: items.length, industries: pool.inds, items });
});

// Company lookup (name + market + currency)
app.get("/api/company/:ticker", (req, res) => {
  const raw = String(req.params.ticker || "");
  const up = raw.toUpperCase();

  let hit = US.list.find((x) => x.ticker.toUpperCase() === up);
  if (hit) return res.json({ ticker: hit.ticker, name: hit.name, market: "us", currency: CURRENCY_BY_MARKET.us });

  hit = SA.list.find((x) => x.ticker.toUpperCase() === up);
  if (hit) return res.json({ ticker: hit.ticker, name: hit.name, market: "sa", currency: CURRENCY_BY_MARKET.sa });

  return res.status(404).json({ error: "Ticker not found in US/SA lists." });
});

// PRICE: no disk save, no-store
app.get("/api/price/:ticker", async (req, res) => {
  const requestedMarket = (req.query.market || "").toString().toLowerCase();
  const r = resolveMarketAndSymbol(req.params.ticker, requestedMarket);
  if (!r.ok) return res.status(400).json({ error: "Ticker not allowed." });
  const { market, symbol, tickerUS, tickerSA, currency } = r;

  try {
    const j = await fetchJson(`${BASE}/price?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`);
    const price = toNumber(j?.price) ?? 0;
    res.set("Cache-Control", "no-store");
    return res.json({
      source: "live",
      ticker: market === "us" ? tickerUS : tickerSA,
      market, price: Number.isFinite(price) ? price : 0,
      currency, fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.set("Cache-Control", "no-store");
    return res.status(502).json({ error: String(e?.message || e) });
  }
});

// FINANCIALS: 30d disk cache, but SKIP writing if years.length === 0
app.get("/api/financials/:ticker", async (req, res) => {
  const requestedMarket = (req.query.market || "").toString().toLowerCase();
  const rawTicker = String(req.params.ticker || "");
  const tickerUS = rawTicker.toUpperCase();
  const tickerSA = rawTicker;

  let market = requestedMarket === "sa" ? "sa" : requestedMarket === "us" ? "us" : null;
  if (!market) {
    if (US_SET.has(tickerUS)) market = "us";
    else if (SA_SET.has(tickerSA.toUpperCase())) market = "sa";
    else return res.status(400).json({ error: "Ticker not allowed." });
  }
  const symbol = market === "us" ? tickerUS : `${tickerSA}:TADAWUL`;

  const pth = cachePath(market, market === "us" ? tickerUS : tickerSA);

  // If we have a cache file but it has no years, ignore & delete it
  const cached = await readCache(pth, CACHE_TTL_DAYS);
  if (cached.ok) {
    const hasYears = Array.isArray(cached.data?.years) && cached.data.years.length > 0;
    if (hasYears) return res.json({ source: "cache", ...cached.data });
    // delete empty cache file to prevent future hits
    try { await fs.unlink(pth); } catch {}
    // continue to live fetch
  }

  const warnings = [];
  const qs = "&period=annual";
  const [income, balance, cash] = await Promise.all([
    fetchJson(`${BASE}/income_statement?symbol=${encodeURIComponent(symbol)}${qs}&apikey=${API_KEY}`).catch(e => { warnings.push(`income_statement: ${e.message}`); return null; }),
    fetchJson(`${BASE}/balance_sheet?symbol=${encodeURIComponent(symbol)}${qs}&apikey=${API_KEY}`).catch(e => { warnings.push(`balance_sheet: ${e.message}`); return null; }),
    fetchJson(`${BASE}/cash_flow?symbol=${encodeURIComponent(symbol)}${qs}&apikey=${API_KEY}`).catch(e => { warnings.push(`cash_flow: ${e.message}`); return null; })
  ]);

  const merged = mergeFinancials({ income, balance, cash, ticker: market === "us" ? tickerUS : tickerSA, warnings });

  const hasYears = Array.isArray(merged.years) && merged.years.length > 0;

  // Only write cache when there is meaningful data
  if (hasYears) {
    await writeCache(pth, merged);
    return res.json({ source: "live", ...merged });
  }

  // Nothing to save — do NOT write a file
  return res.json({ source: "live-empty", ...merged });
});

// VALUATION: no disk save, no-store
app.get("/api/valuation/:ticker", async (req, res) => {
  const requestedMarket = (req.query.market || "").toString().toLowerCase();
  const r = resolveMarketAndSymbol(req.params.ticker, requestedMarket);
  if (!r.ok) return res.status(400).json({ error: "Ticker not allowed." });
  const { market, symbol, tickerUS, tickerSA, currency } = r;

  const enc = encodeURIComponent;
  const [priceJson, statsJson, bsJson, isJson] = await Promise.all([
    fetchJson(`${BASE}/price?symbol=${enc(symbol)}&apikey=${API_KEY}`).catch(()=>({})),
    fetchJson(`${BASE}/statistics?symbol=${enc(symbol)}&apikey=${API_KEY}`).catch(()=>({})),
    fetchJson(`${BASE}/balance_sheet?symbol=${enc(symbol)}&apikey=${API_KEY}`).catch(()=>({})),
    fetchJson(`${BASE}/income_statement?symbol=${enc(symbol)}&apikey=${API_KEY}`).catch(()=>({}))
  ]);

  const stats = statsJson?.statistics || statsJson || {};
  const price = toNumber(priceJson?.price) ?? 0;

  const bs0 = Array.isArray(bsJson?.balance_sheet) ? bsJson.balance_sheet[0]
            : Array.isArray(bsJson?.balance_sheet?.annual) ? bsJson.balance_sheet.annual.at(-1)
            : bsJson?.balance_sheet || {};
  const is0 = Array.isArray(isJson?.income_statement) ? isJson.income_statement[0]
            : Array.isArray(isJson?.income_statement?.annual) ? isJson.income_statement.annual.at(-1)
            : isJson?.income_statement || {};

  const sharesOutstanding = Math.max(0, coalesce(
    stats?.stock_statistics?.shares_outstanding,
    stats?.stock_statistics?.shares_outstanding_5y_avg,
    stats?.shares_outstanding
  ));

  const evFromStats   = coalesce(stats?.valuations_metrics?.enterprise_value, stats?.valuation?.enterprise_value, stats?.enterprise_value);
  const longTermDebt  = coalesce(bs0?.liabilities?.non_current_liabilities?.long_term_debt, stats?.financials?.long_term_debt);
  const shortTermDebt = coalesce(bs0?.liabilities?.current_liabilities?.short_term_debt,  stats?.financials?.short_term_debt);
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

  const forwardPE    = coalesce(stats?.valuations_metrics?.forward_pe);
  const netIncome    = coalesce(is0?.net_income, is0?.net_income_loss);
  const priceToSales = coalesce(stats?.valuations_metrics?.price_to_sales_ttm);
  const sales        = coalesce(is0?.sales, is0?.revenue, is0?.total_revenue);

  const totalEquityRaw = (bs0?.shareholders_equity?.total_shareholders_equity
                       ?? bs0?.total_shareholders_equity
                       ?? bs0?.shareholders_equity?.total_equity);
  const totalEquity    = coalesce(totalEquityRaw);
  const equityPerShare = sharesOutstanding > 0 ? (totalEquity / sharesOutstanding) : 0;

  let fairEV = 0, fairPE = 0, fairPS = 0;
  if (sharesOutstanding > 0) {
    fairEV = (enterpriseValue - longTermDebt + cashEq) / sharesOutstanding;
    fairPE = (forwardPE * netIncome) / sharesOutstanding;
    fairPS = (priceToSales * sales) / sharesOutstanding;
  }

  const payload = {
    ticker: market === "us" ? tickerUS : tickerSA,
    market,
    fetchedAt: new Date().toISOString(),
    currency,
    price: Number.isFinite(price) ? price : 0,
    fairEV: Number.isFinite(fairEV) ? fairEV : 0,
    fairPE: Number.isFinite(fairPE) ? fairPE : 0,
    fairPS: Number.isFinite(fairPS) ? fairPS : 0,
    equityPerShare: Number.isFinite(equityPerShare) ? equityPerShare : 0
  };

  res.set("Cache-Control", "no-store");
  res.json({ source: "live", ...payload });
});

/* ---------------- Start ---------------- */
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`DATA_DIR  => ${DATA_DIR}`);
  console.log(`CACHE_DIR => ${CACHE_DIR}`);
  console.log(`US JSON   => ${US_FILE} ${fssync.existsSync(US_FILE) ? "(found)" : "(missing)"}`);
  console.log(`SA JSON   => ${SA_FILE} ${fssync.existsSync(SA_FILE) ? "(found)" : "(missing)"}`);
});

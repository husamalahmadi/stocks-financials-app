// FILE: client/src/services/tasiDataService.js
/**
 * Loads TASI financial data from local JSON.
 * Primary: tasi_financial_data.json (Twelve-style, by industry).
 * Fallback: tasi_all_financial_data.json (flat companies[]) when the primary file is missing or invalid JSON.
 */

import { publicUrl } from "../utils/publicUrl.js";
import { stripExchangeSuffix } from "../data/stocksCatalog.js";
import {
  iterateCompaniesFromRootJson,
  localJsonToFinancialsFormat,
  localJsonToValuationFormat,
} from "./localFinancialJsonAdapters.js";

const TASI_DATA_URLS = [
  publicUrl("data/tasi_financial_data.json"),
  publicUrl("data/tasi_all_financial_data.json"),
];

const FETCH_ATTEMPTS = 3;

/** Successful parse with at least one company — kept for the SPA session. */
let _tasiResolved = null;
/** In-flight load (dedupes parallel callers). */
let _tasiInflight = null;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildTickerMap(json) {
  const byTicker = new Map();
  for (const c of iterateCompaniesFromRootJson(json)) {
    const t = String(c?.ticker ?? "").trim();
    if (t) {
      byTicker.set(t, c);
      byTicker.set(t.toUpperCase(), c);
    }
  }
  return byTicker;
}

async function fetchTasiPayload() {
  for (const url of TASI_DATA_URLS) {
    for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          await delay(350 * (attempt + 1));
          continue;
        }
        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          await delay(350 * (attempt + 1));
          continue;
        }
        const byTicker = buildTickerMap(json);
        if (byTicker.size > 0) {
          return { raw: json, byTicker };
        }
      } catch {
        await delay(350 * (attempt + 1));
      }
    }
  }
  return { raw: { industries: {} }, byTicker: new Map() };
}

/**
 * Loads once on success; retries on later calls if the bundle was missing or the first fetch failed.
 * Avoids pinning an empty Map forever (which zeroed valuation while cached financials still showed charts).
 */
async function loadTasiData() {
  if (_tasiResolved) return _tasiResolved;
  if (_tasiInflight) return _tasiInflight;

  _tasiInflight = (async () => {
    const result = await fetchTasiPayload();
    if (result.byTicker.size > 0) {
      _tasiResolved = result;
    }
    return result;
  })();

  try {
    return await _tasiInflight;
  } finally {
    _tasiInflight = null;
  }
}

/**
 * Get TASI company data by ticker. Returns null if not found.
 */
export async function getTasiCompanyData(ticker) {
  const { byTicker } = await loadTasiData();
  const t = stripExchangeSuffix(String(ticker ?? "").trim());
  return byTicker.get(t) ?? byTicker.get(t.toUpperCase()) ?? null;
}

export const tasiToFinancialsFormat = localJsonToFinancialsFormat;
export const tasiToValuationFormat = localJsonToValuationFormat;

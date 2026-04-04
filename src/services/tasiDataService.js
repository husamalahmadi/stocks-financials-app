// FILE: client/src/services/tasiDataService.js
/**
 * Loads TASI financial data from local JSON (same idea as sp500DataService).
 * Primary: tasi_financial_data.json (Twelve-style industries tree).
 * Secondary: tasi_all_financial_data.json — only used if the primary fetch/parse fails or yields no companies.
 */

import { publicUrl } from "../utils/publicUrl.js";
import {
  iterateCompaniesFromRootJson,
  localJsonToFinancialsFormat,
  localJsonToValuationFormat,
} from "./localFinancialJsonAdapters.js";

const TASI_DATA_URLS = [
  publicUrl("data/tasi_financial_data.json"),
  publicUrl("data/tasi_all_financial_data.json"),
];

let _tasiPromise = null;

function buildMap(json) {
  const byTicker = new Map();
  for (const c of iterateCompaniesFromRootJson(json)) {
    const t = String(c?.ticker ?? "").trim().toUpperCase();
    if (t) byTicker.set(t, c);
  }
  return byTicker;
}

async function loadTasiData() {
  if (_tasiPromise) return _tasiPromise;
  _tasiPromise = (async () => {
    for (const url of TASI_DATA_URLS) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const json = await res.json();
        const byTicker = buildMap(json);
        if (byTicker.size > 0) {
          return { raw: json, byTicker };
        }
      } catch {
        /* try next URL */
      }
    }
    return { raw: { industries: {} }, byTicker: new Map() };
  })();
  return _tasiPromise;
}

/** True if at least one company was loaded (bundle fetch + parse succeeded). */
export async function isTasiBundleReady() {
  const { byTicker } = await loadTasiData();
  return byTicker.size > 0;
}

/**
 * Get TASI company data by ticker. Returns null if not found.
 */
export async function getTasiCompanyData(ticker) {
  const { byTicker } = await loadTasiData();
  const t = String(ticker ?? "").trim().toUpperCase();
  return byTicker.get(t) ?? null;
}

export const tasiToFinancialsFormat = localJsonToFinancialsFormat;
export const tasiToValuationFormat = localJsonToValuationFormat;

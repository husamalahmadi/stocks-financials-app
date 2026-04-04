// FILE: client/src/services/tasiDataService.js
/**
 * Loads TASI financial data from local tasi_financial_data.json.
 * Used instead of Twelve Data API for SA (TASI) companies - except stock price.
 * Same pattern as sp500DataService.js / sp500_financial_data.json (Twelve-style industries tree).
 */

import { publicUrl } from "../utils/publicUrl.js";
import {
  iterateCompaniesFromRootJson,
  localJsonToFinancialsFormat,
  localJsonToValuationFormat,
} from "./localFinancialJsonAdapters.js";

const TASI_DATA_URL = publicUrl("data/tasi_financial_data.json");

let _tasiPromise = null;

async function loadTasiData() {
  if (_tasiPromise) return _tasiPromise;
  _tasiPromise = (async () => {
    try {
      const res = await fetch(TASI_DATA_URL, { cache: "no-store" });
      if (!res.ok) return { raw: { industries: {} }, byTicker: new Map() };
      const json = await res.json();
      const byTicker = new Map();
      for (const c of iterateCompaniesFromRootJson(json)) {
        const t = String(c?.ticker ?? "").trim().toUpperCase();
        if (t) byTicker.set(t, c);
      }
      return { raw: json, byTicker };
    } catch {
      return { raw: { industries: {} }, byTicker: new Map() };
    }
  })();
  return _tasiPromise;
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

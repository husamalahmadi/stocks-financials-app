// FILE: client/src/services/tasiDataService.js
/**
 * Loads TASI financial data from local tasi_financial_data.json.
 * Used instead of Twelve Data API for SA (TASI) companies - except stock price.
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
    const res = await fetch(TASI_DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load TASI data: ${res.status}`);
    const json = await res.json();
    const byTicker = new Map();
    for (const c of iterateCompaniesFromRootJson(json)) {
      const t = String(c?.ticker ?? "").trim();
      if (t) {
        byTicker.set(t, c);
        byTicker.set(t.toUpperCase(), c);
      }
    }
    return { raw: json, byTicker };
  })();
  return _tasiPromise;
}

/**
 * Get TASI company data by ticker. Returns null if not found.
 */
export async function getTasiCompanyData(ticker) {
  const { byTicker } = await loadTasiData();
  const t = String(ticker ?? "").trim();
  return byTicker.get(t) ?? byTicker.get(t.toUpperCase()) ?? null;
}

export const tasiToFinancialsFormat = localJsonToFinancialsFormat;
export const tasiToValuationFormat = localJsonToValuationFormat;

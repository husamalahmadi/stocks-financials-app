// FILE: client/src/services/sp500DataService.js
/**
 * Loads S&P 500 financial data from local sp500_financial_data.json.
 * Used instead of Twelve Data API for US (S&P 500) companies - except stock price.
 */

import { publicUrl } from "../utils/publicUrl.js";
import {
  iterateCompaniesFromRootJson,
  localJsonToFinancialsFormat,
  localJsonToValuationFormat,
} from "./localFinancialJsonAdapters.js";

const SP500_DATA_URL = publicUrl("data/sp500_financial_data.json");

let _sp500Promise = null;

async function loadSp500Data() {
  if (_sp500Promise) return _sp500Promise;
  _sp500Promise = (async () => {
    try {
      const res = await fetch(SP500_DATA_URL, { cache: "no-store" });
      if (!res.ok) return { raw: { companies: [] }, byTicker: new Map() };
      const json = await res.json();
      const byTicker = new Map();
      for (const c of iterateCompaniesFromRootJson(json)) {
        const t = String(c?.ticker ?? "").trim().toUpperCase();
        if (t) byTicker.set(t, c);
      }
      return { raw: json, byTicker };
    } catch {
      return { raw: { companies: [] }, byTicker: new Map() };
    }
  })();
  return _sp500Promise;
}

/**
 * Get S&P 500 company data by ticker. Returns null if not found.
 */
export async function getSp500CompanyData(ticker) {
  const { byTicker } = await loadSp500Data();
  const t = String(ticker ?? "").trim().toUpperCase();
  return byTicker.get(t) ?? null;
}

export const sp500ToFinancialsFormat = localJsonToFinancialsFormat;
export const sp500ToValuationFormat = localJsonToValuationFormat;

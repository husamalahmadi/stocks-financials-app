/**
 * Check and fix missing financial data in flat aggregate JSON files (not the Twelve-style
 * sp500_financial_data.json / tasi_financial_data.json used by the app).
 * - Removes null/undefined values from time-series arrays
 * - Removes zero values (treated as missing/placeholder)
 * - Reports empty arrays and missing fields
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TIME_SERIES_FIELDS = ['sales', 'gross_profit', 'operating_income', 'net_income', 'equity', 'free_cash_flow'];

const FILES = [
  { path: 'public/data/sp500_all_financial_data.json', name: 'S&P 500' },
  { path: 'public/data/tasi_all_financial_data.json', name: 'TASI' },
];

function fixAndValidate(filePath) {
  const fullPath = join(process.cwd(), filePath);
  let json;
  try {
    json = JSON.parse(readFileSync(fullPath, 'utf-8'));
  } catch (e) {
    return { error: e.message };
  }

  const report = { fixed: [], emptyArrays: [], nullScalars: [] };
  let totalFixed = 0;

  for (const company of json.companies || []) {
    const { ticker, company: companyName, data } = company;
    if (!data) continue;

    for (const field of TIME_SERIES_FIELDS) {
      const arr = data[field];
      if (!Array.isArray(arr)) continue;

      const filtered = arr.filter((item) => {
        if (item && typeof item === 'object' && 'value' in item) {
          const v = item.value;
          if (v == null) return false;
          if (v === 0) return false;
          return true;
        }
        return true;
      });
      const removed = arr.length - filtered.length;

      if (removed > 0) {
        data[field] = filtered;
        totalFixed += removed;
        report.fixed.push({ ticker, company: companyName, field, removed });
      }

      if (filtered.length === 0) {
        report.emptyArrays.push({ ticker, company: companyName, field });
      }
    }
  }

  return { json, report, totalFixed };
}

console.log('\n=== Checking and fixing financial data files ===\n');

for (const { path, name } of FILES) {
  const fullPath = join(process.cwd(), path);
  console.log(`\n--- ${name} (${path}) ---`);

  const result = fixAndValidate(path);
  if (result.error) {
    console.log(`  Error: ${result.error}`);
    continue;
  }

  const { json, report, totalFixed } = result;

  if (totalFixed > 0) {
    writeFileSync(fullPath, JSON.stringify(json, null, 2), 'utf-8');
    console.log(`  ✓ Removed ${totalFixed} null/zero values`);
    report.fixed.slice(0, 10).forEach((r) => {
      console.log(`    - ${r.ticker} (${r.company}): ${r.field} - ${r.removed} removed`);
    });
    if (report.fixed.length > 10) {
      console.log(`    ... and ${report.fixed.length - 10} more`);
    }
  } else {
    console.log(`  ✓ No null/zero values to remove`);
  }

  if (report.emptyArrays.length > 0) {
    const byField = {};
    report.emptyArrays.forEach((e) => {
      byField[e.field] = (byField[e.field] || 0) + 1;
    });
    console.log(`  Empty arrays (no data available): ${report.emptyArrays.length}`);
    Object.entries(byField).forEach(([f, c]) => console.log(`    ${f}: ${c} companies`));
  }
}

console.log('\n=== Done ===\n');

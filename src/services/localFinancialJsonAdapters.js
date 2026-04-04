/**
 * Normalizes local JSON from either:
 * - "flat" bundle: { companies: [{ ticker, data: { sales[], equity[], ... } }] }
 * - Twelve-style bundle: { industries: { [name]: { companies: { [ticker]: { data: { statistics, income_statement, ... } } } } } }
 */

export function* iterateCompaniesFromRootJson(json) {
  if (Array.isArray(json?.companies)) {
    for (const c of json.companies) yield c;
    return;
  }
  for (const ind of Object.values(json?.industries || {})) {
    for (const c of Object.values(ind?.companies || {})) {
      if (c && typeof c === "object") yield c;
    }
  }
}

function isTwelveStyleData(d) {
  return (
    Array.isArray(d?.income_statement?.income_statement) &&
    Array.isArray(d?.balance_sheet?.balance_sheet) &&
    Array.isArray(d?.cash_flow?.cash_flow)
  );
}

/**
 * True if `company.data` has enough for valuation (flat or Twelve-style).
 */
export function localJsonDataHasValuationInputs(d) {
  if (!d) return false;
  if (isTwelveStyleData(d)) {
    const shares = d.statistics?.statistics?.stock_statistics?.shares_outstanding;
    if (shares == null || shares <= 0) return false;
    const vm = d.statistics?.statistics?.valuations_metrics;
    if (vm?.enterprise_value != null || vm?.market_capitalization != null) return true;
    return (
      d.balance_sheet.balance_sheet.length > 0 &&
      d.income_statement.income_statement.length > 0
    );
  }
  return (
    d.outstanding_common_stocks != null &&
    d.outstanding_common_stocks > 0 &&
    (d.enterprise_value != null ||
      d.market_capitalization != null ||
      (d.equity?.length > 0 && (d.sales?.length > 0 || d.net_income?.length > 0)))
  );
}

export function localJsonToFinancialsFormat(companyData) {
  const d = companyData?.data;
  if (!d) return { income: [], balance: [], cash: [] };

  if (isTwelveStyleData(d)) {
    return {
      income: d.income_statement.income_statement,
      balance: d.balance_sheet.balance_sheet,
      cash: d.cash_flow.cash_flow,
    };
  }

  const years = new Set();
  for (const arr of [d.sales, d.gross_profit, d.operating_income, d.net_income, d.equity, d.free_cash_flow]) {
    for (const it of arr || []) if (it?.fiscal_date) years.add(it.fiscal_date);
  }

  const byDate = new Map();
  for (const fd of years) {
    byDate.set(fd, { fiscal_date: fd, year: null });
  }

  for (const it of d.sales || []) {
    const row = byDate.get(it.fiscal_date);
    if (row) {
      row.year = it.year;
      row.sales = it.value;
    }
  }
  for (const it of d.gross_profit || []) {
    const row = byDate.get(it.fiscal_date);
    if (row) row.gross_profit = it.value;
  }
  for (const it of d.operating_income || []) {
    const row = byDate.get(it.fiscal_date);
    if (row) row.operating_income = it.value;
  }
  for (const it of d.net_income || []) {
    const row = byDate.get(it.fiscal_date);
    if (row) row.net_income = it.value;
  }

  const income = [...byDate.values()].filter((r) => r.sales != null || r.operating_income != null || r.net_income != null);

  const balance = [];
  for (const it of d.equity || []) {
    balance.push({
      fiscal_date: it.fiscal_date,
      year: it.year,
      shareholders_equity: { total_shareholders_equity: it.value },
    });
  }

  const cash = [];
  for (const it of d.free_cash_flow || []) {
    cash.push({
      fiscal_date: it.fiscal_date,
      year: it.year,
      free_cash_flow: it.value,
    });
  }

  return {
    income: income.sort((a, b) => String(a.fiscal_date || "").localeCompare(String(b.fiscal_date || ""))),
    balance,
    cash,
  };
}

export function localJsonToValuationFormat(companyData) {
  const d = companyData?.data;
  if (!d) return null;

  if (isTwelveStyleData(d) && d.statistics?.statistics) {
    return {
      stats: d.statistics.statistics,
      balance_sheet: d.balance_sheet.balance_sheet,
      income_statement: d.income_statement.income_statement,
    };
  }

  const stats = {
    valuations_metrics: {
      enterprise_value: d.enterprise_value,
      market_capitalization: d.market_capitalization,
      forward_pe: d.forward_pe,
      price_to_sales_ttm: d.price_to_sales_ttm,
    },
    stock_statistics: {
      shares_outstanding: d.outstanding_common_stocks,
    },
    financials: {
      long_term_debt: d.long_term_debt,
      cash_and_cash_equivalents: d.cash_and_cash_equivalents,
    },
  };

  const eq = d.equity?.[0];
  const inc = [
    {
      sales: d.sales?.[0]?.value,
      net_income: d.net_income?.[0]?.value,
    },
  ];

  const balance = [
    {
      shareholders_equity: eq ? { total_shareholders_equity: eq.value } : {},
      liabilities: {
        current_liabilities: { short_term_debt: d.short_term_debt },
        non_current_liabilities: { long_term_debt: d.long_term_debt },
      },
      assets: {
        current_assets: {
          cash_and_cash_equivalents: d.cash_and_cash_equivalents,
          cash: d.cash_and_cash_equivalents,
        },
      },
    },
  ];

  return {
    stats,
    balance_sheet: balance,
    income_statement: inc,
  };
}

// FILE: client/src/i18n.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const I18nContext = createContext(null);

const dict = {
  en: {
    EN: "EN",
    AR: "AR",

    // Shared
    REPORT: "Trueprice.cash Financial Report",
    DASHBOARD: "Trueprice.cash",
    CONTACT_US: "Contact us",
    ABOUT_US: "About us",
    TICKER: "Ticker",
    REPORT_DATE: "Report date",
    PRICE: "Price",
    LOADING: "Loading…",
    N_A: "N/A",
    NO_DATA: "No data",

    // Trend words (some components may use these)
    UP: "Uptrend",
    DOWN: "Downtrend",
    FLAT: "Stable",
    UPTREND: "Uptrend",
    DOWNTREND: "Downtrend",
    NEUTRAL: "Stable",
    TREND: "Trend",

    // Home
    FILTERS: "Filters",
    COMPANIES: "Companies",
    RESET: "Reset",
    SEARCH_PLACEHOLDER: "Search by name or ticker…",
    MARKET_US: "US equities",
    MARKET_SA: "Saudi equities",
    INDUSTRY_ALL: "All industries",
    MARKET: "Market",
    INDUSTRY: "Industry",
    SEARCH: "Search",
    SOURCE: "Source",
    NO_RESULTS: "No results.",
    ERR_LOAD_STOCKS: "Failed to load stocks.",
    NO_MATCH: "No matching companies.",

    // Stock section titles
    EXEC_SUM: "1. Executive Summary",
    FAIR_VALUE_SECTION: "2. Fair Value Analysis",
    REV_INC_TITLE: "3. Revenue & Income (USD)",
    EQUITY_FCF_TITLE: "4. Equity & Free Cash Flow (USD)",
    APPENDIX: "Appendix: Financial statements (all years)",

    // Metrics / labels (existing)
    REV_GROWTH: "Revenue growth",
    REV_CAGR: "Revenue CAGR",
    OP_MARGIN: "Operating margin",
    NET_MARGIN: "Net margin",
    FCF_MARGIN: "FCF margin",
    EQUITY_GROWTH: "Equity growth",
    FCF_GROWTH: "FCF growth",
    FAIR_VALUE: "Fair value",
    UPSIDE: "Upside",
    EV_SALES: "EV/Sales",
    PE: "P/E",
    PS: "P/S",
    MARKET_CAP: "Market cap",
    ENTERPRISE_VALUE: "Enterprise value",
    EV_PER_SHARE: "EV per share",
    METHOD: "Method",
    VALUE: "Value",
    NOTES: "Notes",

    // ✅ Missing keys your Stock.jsx uses
    REVENUE: "Revenue",
    OP_INCOME: "Operating income",
    NET_INCOME: "Net income",
    FCF: "Free cash flow",
    TOTAL_EQUITY: "Total equity",
    YEAR: "Year",

    CUR_PRICE: "Current price",
    FAIR_AVG: "Fair value (avg)",
    FAIR_ABBR: "FV",

    VAL_METHODS: "Valuation methods",
    EV_SHARE: "EV / share",
    PS_BASED: "P/S based",
    PE_BASED: "P/E based",
    EQUITY_PER_SHARE: "Equity per share",

    // Optional namespaces (supported by resolver)
    labels: {},
    metrics: {},
  },

  ar: {
    EN: "EN",
    AR: "AR",

    // Shared
    REPORT: "تقرير Trueprice.cash المالي",
    DASHBOARD: "Trueprice.cash",
    CONTACT_US: "اتصل بنا",
    ABOUT_US: "من نحن",
    TICKER: "الرمز",
    REPORT_DATE: "تاريخ التقرير",
    PRICE: "السعر",
    LOADING: "جاري التحميل…",
    N_A: "غير متاح",
    NO_DATA: "لا توجد بيانات",

    // Trend words
    UP: "اتجاه صاعد",
    DOWN: "اتجاه هابط",
    FLAT: "مستقر",
    UPTREND: "اتجاه صاعد",
    DOWNTREND: "اتجاه هابط",
    NEUTRAL: "مستقر",
    TREND: "الاتجاه",

    // Home
    FILTERS: "المرشحات",
    COMPANIES: "الشركات",
    RESET: "إعادة ضبط",
    SEARCH_PLACEHOLDER: "ابحث بالاسم أو الرمز…",
    MARKET_US: "الأسهم الأمريكية",
    MARKET_SA: "الأسهم السعودية",
    INDUSTRY_ALL: "كل القطاعات",
    MARKET: "السوق",
    INDUSTRY: "القطاع",
    SEARCH: "بحث",
    SOURCE: "المصدر",
    NO_RESULTS: "لا توجد نتائج.",
    ERR_LOAD_STOCKS: "فشل تحميل الأسهم.",
    NO_MATCH: "لا توجد شركات مطابقة.",

    // Stock section titles
    EXEC_SUM: "١. الملخص التنفيذي",
    FAIR_VALUE_SECTION: "٢. تحليل القيمة العادلة",
    REV_INC_TITLE: "٣. الإيرادات والدخل (دولار)",
    EQUITY_FCF_TITLE: "٤. حقوق الملكية والتدفق النقدي الحر (دولار)",
    APPENDIX: "الملحق: القوائم المالية (كل السنوات)",

    // Metrics / labels (existing)
    REV_GROWTH: "نمو الإيرادات",
    REV_CAGR: "معدل النمو السنوي المركب للإيرادات",
    OP_MARGIN: "هامش التشغيل",
    NET_MARGIN: "هامش صافي الربح",
    FCF_MARGIN: "هامش التدفق النقدي الحر",
    EQUITY_GROWTH: "نمو حقوق الملكية",
    FCF_GROWTH: "نمو التدفق النقدي الحر",
    FAIR_VALUE: "القيمة العادلة",
    UPSIDE: "الصعود المتوقع",
    EV_SALES: "قيمة المنشأة/المبيعات",
    PE: "مكرر الربحية",
    PS: "مكرر المبيعات",
    MARKET_CAP: "القيمة السوقية",
    ENTERPRISE_VALUE: "قيمة المنشأة",
    EV_PER_SHARE: "قيمة المنشأة للسهم",
    METHOD: "الطريقة",
    VALUE: "القيمة",
    NOTES: "ملاحظات",

    // ✅ Missing keys your Stock.jsx uses
    REVENUE: "الإيرادات",
    OP_INCOME: "الدخل التشغيلي",
    NET_INCOME: "صافي الدخل",
    FCF: "التدفق النقدي الحر",
    TOTAL_EQUITY: "إجمالي حقوق الملكية",
    YEAR: "السنة",

    CUR_PRICE: "السعر الحالي",
    FAIR_AVG: "القيمة العادلة (متوسط)",
    FAIR_ABBR: "ق.ع",

    VAL_METHODS: "طرق التقييم",
    EV_SHARE: "قيمة المنشأة للسهم",
    PS_BASED: "بناءً على مكرر المبيعات",
    PE_BASED: "بناءً على مكرر الربحية",
    EQUITY_PER_SHARE: "حقوق الملكية للسهم",

    // Optional namespaces (supported by resolver)
    labels: {},
    metrics: {},
  },
};

function getByPath(obj, key) {
  if (!obj || !key) return undefined;
  if (!key.includes(".")) return obj[key];
  return key.split(".").reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), obj);
}

function resolveKey(langObj, key) {
  if (!langObj) return undefined;

  // 1) direct flat key
  const direct = getByPath(langObj, key);
  if (direct != null) return direct;

  // 2) allow calling t("labels.X") / t("metrics.X")
  const inLabelsByPath = getByPath(langObj.labels, key);
  if (inLabelsByPath != null) return inLabelsByPath;

  const inMetricsByPath = getByPath(langObj.metrics, key);
  if (inMetricsByPath != null) return inMetricsByPath;

  // 3) allow calling t("X") while X exists inside labels/metrics
  const inLabels = langObj.labels?.[key];
  if (inLabels != null) return inLabels;

  const inMetrics = langObj.metrics?.[key];
  if (inMetrics != null) return inMetrics;

  return undefined;
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const v = localStorage.getItem("lang");
    return v === "ar" ? "ar" : "en";
  });

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const t = useMemo(() => {
    const current = dict[lang] || dict.en;

    return (key) => {
      const v1 = resolveKey(current, key);
      if (v1 != null) return v1;

      const v2 = resolveKey(dict.en, key);
      if (v2 != null) return v2;

      return key;
    };
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t,
      setLang,
      toggleLang: () => setLang((p) => (p === "en" ? "ar" : "en")),
    }),
    [lang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

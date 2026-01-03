// FILE: client/src/i18n.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const I18nContext = createContext(null);

const dict = {
  en: {
    EN: "EN",
    AR: "AR",

    // Shared
    REPORT: "Financial Analysis Report",
    DASHBOARD: "Financial Analysis — Dashboard",
    CONTACT_US: "Contact us",
    TICKER: "Ticker",
    REPORT_DATE: "Report date",
    PRICE: "Price",
    LOADING: "Loading…",
    N_A: "N/A",

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
    EXEC_SUM: "1. Executive summary",
    FAIR_VALUE_SECTION: "2. Fair value analysis",
    REV_INC_TITLE: "3. Revenue & income (USD)",
    EQUITY_FCF_TITLE: "4. Equity & free cash flow (USD)",
    APPENDIX: "Appendix: financial statements (all years)",

    // Metrics/labels
    REV_GROWTH: "Revenue growth",
    OP_INCOME: "Operating income",
    NET_INCOME: "Net income",
    FCF: "Free cash flow",
    STOCK_VALUATION: "Stock valuation",
    CUR_PRICE: "Current price",
    FAIR_AVG: "Fair value (avg)",
    VAL_METHODS: "Valuation methods",
    EV_SHARE: "EV / share",
    PS_BASED: "P/S based",
    PE_BASED: "P/E based",
    EQUITY_PER_SHARE: "Equity per share",
    YEAR: "Year",
    REVENUE: "Revenue",
    TOTAL_EQUITY: "Total equity",

    // States
    ERR_STATEMENTS: "Failed to load statements.",
    ERR_VALUATION: "Failed to load valuation.",

    // Derived text
    UP: "up",
    DOWN: "down",
    FLAT: "flat",
    NO_DATA: "no data",
    FAIR_ABBR: "fair",

    // Trend labels
    TREND: "Trend",
    UPTREND: "Uptrend",
    DOWNTREND: "Downtrend",
    NEUTRAL: "Neutral",
  },

  ar: {
    EN: "إنج",
    AR: "عر",

    // Shared
    REPORT: "تقرير التحليل المالي",
    DASHBOARD: "لوحة التحليل المالي",
    CONTACT_US: "اتصل بنا",
    TICKER: "الرمز",
    REPORT_DATE: "تاريخ التقرير",
    PRICE: "السعر",
    LOADING: "جاري التحميل…",
    N_A: "غير متاح",

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

    // Metrics/labels
    REV_GROWTH: "نمو الإيرادات",
    OP_INCOME: "دخل العمليات",
    NET_INCOME: "صافي الدخل",
    FCF: "التدفق النقدي الحر",
    STOCK_VALUATION: "تقييم السهم",
    CUR_PRICE: "السعر الحالي",
    FAIR_AVG: "القيمة العادلة (متوسط)",
    VAL_METHODS: "طرق التقييم",
    EV_SHARE: "القيمة المنشأة / سهم",
    PS_BASED: "مضاعف المبيعات",
    PE_BASED: "مضاعف الربحية",
    EQUITY_PER_SHARE: "حقوق الملكية / سهم",
    YEAR: "السنة",
    REVENUE: "الإيرادات",
    TOTAL_EQUITY: "إجمالي حقوق الملكية",

    // States
    ERR_STATEMENTS: "فشل تحميل القوائم المالية.",
    ERR_VALUATION: "فشل تحميل التقييم.",

    // Derived text
    UP: "ارتفاع",
    DOWN: "انخفاض",
    FLAT: "ثبات",
    NO_DATA: "لا توجد بيانات",
    FAIR_ABBR: "عادل",

    // Trend labels
    TREND: "الاتجاه",
    UPTREND: "اتجاه صاعد",
    DOWNTREND: "اتجاه هابط",
    NEUTRAL: "محايد",
  },
};

function detectInitialLang() {
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "en" || saved === "ar") return saved;
    const nav = (navigator.language || "").toLowerCase();
    return nav.startsWith("ar") ? "ar" : "en";
  } catch {
    return "en";
  }
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(detectInitialLang());

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
      localStorage.setItem("lang", lang);
    } catch {
      // ignore
    }
  }, [lang]);

  const t = useMemo(() => {
    const table = dict[lang] || dict.en;
    return (k) => table[k] ?? dict.en[k] ?? k;
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

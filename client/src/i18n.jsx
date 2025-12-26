import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const I18nContext = createContext(null);

/* All strings used in Home.jsx & Stock.jsx */
const dict = {
  en: {
    EN: "EN",
    AR: "AR",
    // Shared
    REPORT: "Financial Analysis Report",
    DASHBOARD: "Financial Analysis — Dashboard",
    TICKER: "Ticker",
    REPORT_DATE: "Report Date",
    PRICE: "Price",
    LOADING: "Loading…",
    N_A: "N/A",
    // Home
    FILTERS: "Filters",
    COMPANIES: "Companies",
    RESET: "Reset",
    SEARCH_PLACEHOLDER: "Search by company or ticker…",
    MARKET_US: "US Stocks",
    MARKET_SA: "Saudi Stocks",
    INDUSTRY_ALL: "All Industries",
    ERR_LOAD_STOCKS: "Failed to load stocks.",
    NO_MATCH: "No companies match your criteria.",
    // Stock section titles
    EXEC_SUM: "1. Executive Summary",
    FAIR_VALUE_SECTION: "2. Stock Fair Value Analysis",
    REV_INC_TITLE: "3. Revenue & Income (USD)",
    EQUITY_FCF_TITLE: "4. Equity & Free Cash Flow (USD)",
    APPENDIX: "Appendix: Financials (All Years)",
    // Metrics/labels
    REV_GROWTH: "Revenue Growth",
    OP_INCOME: "Operating Income",
    NET_INCOME: "Net Income",
    FCF: "Free Cash Flow",
    STOCK_VALUATION: "Stock Valuation",
    CUR_PRICE: "Current Price",
    FAIR_AVG: "Fair Value (average)",
    VAL_METHODS: "Valuation Methods",
    EV_SHARE: "EV / share",
    PS_BASED: "Price/Sales based",
    PE_BASED: "Price/Earnings based",
    EQUITY_PER_SHARE: "Equity per Share",
    YEAR: "Year",
    REVENUE: "Revenue",
    TOTAL_EQUITY: "Total Equity",
    // States
    ERR_STATEMENTS: "Failed to load statements.",
    ERR_VALUATION: "Failed to load valuation.",
    // Derived text
    UP: "up",
    DOWN: "down",
    FLAT: "flat",
    NO_DATA: "no data",
    FAIR_ABBR: "fair",
  },
  ar: {
    EN: "إنج",
    AR: "عر",
    // Shared
    REPORT: "تقرير التحليل المالي",
    DASHBOARD: "لوحة التحليل المالي",
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
    ERR_LOAD_STOCKS: "فشل تحميل الأسهم.",
    NO_MATCH: "لا توجد شركات مطابقة للبحث.",
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
    EQUITY_PER_SHARE: "حقوق/سهم",
    YEAR: "السنة",
    REVENUE: "الإيرادات",
    TOTAL_EQUITY: "حقوق الملكية",
    // States
    ERR_STATEMENTS: "فشل تحميل القوائم المالية.",
    ERR_VALUATION: "فشل تحميل التقييم.",
    // Derived text
    UP: "ارتفاع",
    DOWN: "انخفاض",
    FLAT: "ثابت",
    NO_DATA: "لا بيانات",
    FAIR_ABBR: "عادل",
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
  const [lang, setLang] = useState(detectInitialLang);

  useEffect(() => {
    try { localStorage.setItem("lang", lang); } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }
  }, [lang]);

  const t = useMemo(() => {
    const table = dict[lang] || dict.en;
    return (key) => table[key] ?? key;
  }, [lang]);

  const value = useMemo(() => ({
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    t,
    setLang,
    toggleLang: () => setLang((p) => (p === "en" ? "ar" : "en")),
  }), [lang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

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
    LOADING: "Loading...",
    NO_DATA: "No data",
    TREND: "Trend",
    UPTREND: "Uptrend",
    DOWNTREND: "Downtrend",
    NEUTRAL: "Neutral",

    // Home
    FILTERS: "Filters",
    MARKET: "Market",
    MARKET_US: "US Market",
    MARKET_SA: "Saudi Market",
    INDUSTRY: "Industry",
    INDUSTRY_ALL: "All industries",
    SEARCH: "Search",
    SEARCH_PLACEHOLDER: "Search by name or ticker...",
    RESET: "Reset",
    COMPANIES: "Companies",
    NO_MATCH: "No matching companies.",
    ERR_LOAD_STOCKS: "Failed to load stocks.",

    // Stock
    EXEC_SUM: "1. Executive summary",
    FAIR_VALUE_SECTION: "2. Fair value analysis",
    REV_INC_TITLE: "3. Revenue & income (USD)",
    EQUITY_FCF_TITLE: "4. Equity & free cash flow (USD)",
    APPENDIX: "Appendix: Financial statements (all years)",

    REV_GROWTH: "Revenue growth",
    OP_INCOME: "Operating income",
    NET_INCOME: "Net income",
    FCF: "Free cash flow",
    TOTAL_EQUITY: "Total equity",
    YEAR: "Year",
    REVENUE: "Revenue",

    CUR_PRICE: "Current price",
    FAIR_AVG: "Fair value (avg)",
    FAIR_ABBR: "FV",
    STOCK_VALUATION: "Stock valuation",

    VAL_METHODS: "Valuation methods",
    EV_SHARE: "EV / share",
    PS_BASED: "P/S based",
    PE_BASED: "P/E based",
    EQUITY_PER_SHARE: "Equity / share",

    // Added (missing in your UI)
    ERR_STATEMENTS: "Failed to load financial statements.",
    ERR_VALUATION: "Failed to load valuation.",
  },

  ar: {
    EN: "EN",
    AR: "AR",

    // Shared
    REPORT: "Trueprice.cash - تقرير مالي",
    DASHBOARD: "Trueprice.cash",
    CONTACT_US: "اتصل بنا",
    ABOUT_US: "من نحن",
    TICKER: "رمز السهم",
    REPORT_DATE: "تاريخ التقرير",
    PRICE: "السعر",
    LOADING: "جار التحميل...",
    NO_DATA: "لا توجد بيانات",
    TREND: "الاتجاه",
    UPTREND: "اتجاه صاعد",
    DOWNTREND: "اتجاه هابط",
    NEUTRAL: "محايد",

    // Home
    FILTERS: "الفلاتر",
    MARKET: "السوق",
    MARKET_US: "السوق الأمريكي",
    MARKET_SA: "السوق السعودي",
    INDUSTRY: "القطاع",
    INDUSTRY_ALL: "كل القطاعات",
    SEARCH: "بحث",
    SEARCH_PLACEHOLDER: "ابحث بالاسم أو الرمز...",
    RESET: "إعادة تعيين",
    COMPANIES: "الشركات",
    NO_MATCH: "لا توجد شركات مطابقة.",
    ERR_LOAD_STOCKS: "فشل تحميل قائمة الأسهم.",

    // Stock
    EXEC_SUM: "١. الملخص التنفيذي",
    FAIR_VALUE_SECTION: "٢. تحليل القيمة العادلة",
    REV_INC_TITLE: "٣. الإيرادات والدخل (دولار)",
    EQUITY_FCF_TITLE: "٤. حقوق الملكية والتدفق النقدي الحر (دولار)",
    APPENDIX: "الملحق: القوائم المالية (كل السنوات)",

    REV_GROWTH: "نمو الإيرادات",
    OP_INCOME: "الدخل التشغيلي",
    NET_INCOME: "صافي الربح",
    FCF: "التدفق النقدي الحر",
    TOTAL_EQUITY: "إجمالي حقوق الملكية",
    YEAR: "السنة",
    REVENUE: "الإيرادات",

    CUR_PRICE: "السعر الحالي",
    FAIR_AVG: "القيمة العادلة (المتوسط)",
    FAIR_ABBR: "ق.ع",
    STOCK_VALUATION: "تقييم السهم",

    VAL_METHODS: "طرق التقييم",
    EV_SHARE: "قيمة المنشأة/سهم",
    PS_BASED: "حسب مكرر المبيعات",
    PE_BASED: "حسب مكرر الربحية",
    EQUITY_PER_SHARE: "حقوق الملكية/سهم",

    // Added
    ERR_STATEMENTS: "فشل تحميل القوائم المالية.",
    ERR_VALUATION: "فشل تحميل التقييم.",
  },
};

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
    return (key) => current[key] ?? dict.en[key] ?? key;
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
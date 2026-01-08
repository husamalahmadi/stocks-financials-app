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
    ABOUT_US: "About us",
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
    EXEC_SUM: "1. Executive Summary",
    FAIR_VALUE_SECTION: "2. Fair Value Analysis",
    REV_INC_TITLE: "3. Revenue & Income (USD)",
    EQUITY_FCF_TITLE: "4. Equity & Free Cash Flow (USD)",
    APPENDIX: "Appendix: Financial statements (all years)",

    // Metrics/labels
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
  },

  ar: {
    EN: "EN",
    AR: "AR",

    // Shared
    REPORT: "تقرير التحليل المالي",
    DASHBOARD: "لوحة التحليل المالي",
    CONTACT_US: "اتصل بنا",
    ABOUT_US: "من نحن",
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
    const L = dict[lang] || dict.en;
    return (key) => L[key] || dict.en[key] || key;
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

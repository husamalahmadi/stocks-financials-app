import React, { useMemo } from "react";
import { useI18n } from "../i18n.jsx";

export default function AboutUs() {
  const { lang, dir, t } = useI18n();

  const content = useMemo(
    () => ({
      en: {
        title: "About TruePrice.cash",
        body: [
          "TruePrice.cash is built to help investors navigate equity markets with clear, fundamentals-driven tools.",
          "We estimate a stock’s fair value, highlight the gap between price and value, and summarize business performance by reading core financial statements—revenue, operating income, net income, total shareholders’ equity, and free cash flow.",
          "Our goal is to make financial analysis fast, consistent, and accessible, so investors can make better decisions with confidence.",
        ],
      },
      ar: {
        title: "حول TruePrice.cash",
        body: [
          "تم تطوير TruePrice.cash لمساعدة المستثمرين على التنقل في أسواق الأسهم باستخدام أدوات مالية واضحة مبنية على أساسيات الشركات.",
          "نقدّم تقديراً للقيمة العادلة للسهم ونوضح الفجوة بين السعر والقيمة، مع تلخيص أداء الشركة عبر قراءة القوائم المالية الرئيسية مثل الإيرادات والدخل التشغيلي وصافي الدخل وإجمالي حقوق المساهمين والتدفق النقدي الحر.",
          "هدفنا هو جعل التحليل المالي أسرع وأكثر اتساقاً وأسهل وصولاً، لتمكين المستثمرين من اتخاذ قرارات أفضل بثقة.",
        ],
      },
    }),
    []
  );

  const L = content[lang] || content.en;

  return (
    <div dir={dir} lang={lang} style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
        <div
          style={{
            borderRadius: 18,
            background: "linear-gradient(180deg, #0f172a, #111827)",
            padding: "14px 16px",
            color: "#fff",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900 }}>Trueprice.cash</div>
          <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 2 }}>{t("ABOUT_US")}</div>
        </div>

        <div
          style={{
            marginTop: 16,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 1px 10px rgba(0,0,0,0.04)",
            lineHeight: 1.75,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{L.title}</div>
          <div style={{ marginTop: 10, color: "#334155" }}>
            {L.body.map((p) => (
              <p key={p} style={{ margin: "10px 0" }}>
                {p}
              </p>
            ))}
          </div>
        </div>

        <footer
          style={{
            marginTop: 24,
            padding: "14px 4px",
            textAlign: "center",
            color: "#64748b",
            fontSize: 12,
          }}
        >
          © Trueprice.cash
        </footer>
      </div>
    </div>
  );
}
// FILE: client/src/routes/Stock.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "../i18n.jsx";

/* API base */
function getApiBase() {
  const env = (import.meta.env.VITE_API_BASE || "").trim();
  if (env) return env.replace(/\/+$/, "");
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:5175`; // change if your backend port differs
  }
  return typeof window !== "undefined" ? window.location.origin : "";
}
const API_BASE = getApiBase();

/* Formatting */
function fmt2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtBill(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  const abs = Math.abs(x);
  if (abs >= 1e12) return `${fmt2(x / 1e12)}T`;
  if (abs >= 1e9) return `${fmt2(x / 1e9)}B`;
  if (abs >= 1e6) return `${fmt2(x / 1e6)}M`;
  return fmt2(x);
}

/* Trend helpers */
function sortSeries(series) {
  return (series || [])
    .filter((p) => Number.isFinite(Number(p?.value)))
    .map((p) => ({ label: String(p.label), value: Number(p.value) }))
    .sort((a, b) => Number(a.label) - Number(b.label));
}

function calcTrend(series, { neutralThresholdPct = 2 } = {}) {
  const data = sortSeries(series);
  if (data.length < 2) return { kind: "no_data", pct: null };

  const first = data[0]?.value;
  const last = data[data.length - 1]?.value;

  if (!Number.isFinite(first) || !Number.isFinite(last)) return { kind: "no_data", pct: null };

  const denom = Math.max(Math.abs(first), Math.abs(last), 1);
  const pct = ((last - first) / denom) * 100;

  if (!Number.isFinite(pct)) return { kind: "no_data", pct: null };
  if (Math.abs(pct) < neutralThresholdPct) return { kind: "neutral", pct };

  return { kind: pct > 0 ? "up" : "down", pct };
}

function trendText(series, t) {
  const { kind, pct } = calcTrend(series);
  if (kind === "no_data") return t("NO_DATA");

  const word =
    kind === "up" ? t("UPTREND") : kind === "down" ? t("DOWNTREND") : t("NEUTRAL");

  return `${word} · ${fmt2(Math.abs(pct))}%`;
}

/* Small layout atoms */
function Card({ title, children, style }) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "#fff",
        marginBottom: 16,
        boxShadow: "0 1px 10px rgba(0,0,0,0.04)",
        ...style,
      }}
    >
      {title ? (
        <header
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid #e5e7eb",
            fontWeight: 900,
            color: "#111827",
          }}
        >
          {title}
        </header>
      ) : null}
      <div style={{ padding: 14 }}>{children}</div>
    </section>
  );
}

function LangToggle({ lang, onToggle, t }) {
  const active = lang === "ar";
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      title="Toggle language"
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 999,
        padding: "6px 10px",
        fontWeight: 700,
        background: "#ffffff",
        color: "#111827",
        cursor: "pointer",
      }}
    >
      {active ? t("AR") : t("EN")}
    </button>
  );
}

function CompareBar({ current, fair, currency, dir = "ltr", t }) {
  const cur = Number(current);
  const fv = Number(fair);
  const max = Math.max(cur, fv, 1);
  const curPct = (cur / max) * 100;
  const fairPct = (fv / max) * 100;
  return (
    <div style={{ width: 260, display: "grid", gap: 6 }}>
      <div
        style={{
          height: 10,
          background: "#e5e7eb",
          borderRadius: 999,
          overflow: "hidden",
          position: "relative",
        }}
        dir={dir}
      >
        <div style={{ height: "100%", width: `${curPct}%`, background: "#2563eb" }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 3,
            left: `${fairPct}%`,
            background: "#10b981",
          }}
        />
      </div>
      <div style={{ display: "grid", gap: 2, fontSize: 12, color: "#374151" }}>
        <span>
          {t("CUR_PRICE")}: <b>{fmt2(cur)} {currency}</b>
        </span>
        <span>
          {t("FAIR_AVG")}: <b>{fmt2(fv)} {currency}</b>
        </span>
      </div>
    </div>
  );
}

function LineChart({ title, series, w = 380, dir = "ltr" }) {
  const data = sortSeries(series);

  const h = 220;
  const pad = { t: 22, r: 18, b: 28, l: 56 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;

  if (!data.length) return <div style={{ fontSize: 12, color: "#6b7280" }}>{title}: —</div>;

  const xs = (i) => pad.l + (i * iw) / Math.max(1, data.length - 1);
  const vals = data.map((d) => d.value);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    const d = Math.abs(min || 1) * 0.1;
    min -= d;
    max += d;
  }
  const ys = (v) => pad.t + (1 - (v - min) / (max - min)) * ih;
  const dAttr = data.map((p, i) => `${i ? "L" : "M"} ${xs(i)} ${ys(p.value)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", display: "block" }} direction={dir}>
      <text x={w / 2} y={16} textAnchor="middle" style={{ fontSize: 14, fontWeight: 900 }}>
        {title}
      </text>
      <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} stroke="#e5e7eb" />
      <path d={dAttr} fill="none" stroke="#0f4a5a" strokeWidth="2" />
      {data.map((p, i) => (
        <g key={`${p.label}-${i}`}>
          <circle cx={xs(i)} cy={ys(p.value)} r="3.5" fill="#0f4a5a" />
          <text x={xs(i)} y={h - pad.b + 16} textAnchor="middle" style={{ fontSize: 10, fill: "#6b7280" }}>
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ChartBlock({ title, series, w, dir, t }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <LineChart title={title} series={series} w={w} dir={dir} />
      <div style={{ fontSize: 12, color: "#374151" }}>
        <span style={{ fontWeight: 900 }}>{t("TREND")}:</span>{" "}
        <span style={{ fontWeight: 800 }}>{trendText(series, t)}</span>
      </div>
    </div>
  );
}

/* Page */
export default function Stock() {
  const { ticker } = useParams();
  const { t, lang, dir, toggleLang } = useI18n();

  const [company, setCompany] = useState("");
  const [market, setMarket] = useState("us");
  const [currency, setCurrency] = useState("USD");
  const [price, setPrice] = useState(null);

  const [headerError, setHeaderError] = useState("");

  const [fin, setFin] = useState({ loading: true, error: "", data: null });
  const [val, setVal] = useState({ loading: true, error: "", data: null });

  const reportDate = useMemo(() => new Date().toLocaleDateString(), []);

  /* Company + Price */
  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setHeaderError("");

        const c = await fetch(`${API_BASE}/api/company/${encodeURIComponent(ticker)}`);
        const cj = await c.json();
        if (!alive) return;

        setCompany(cj?.name || "");
        setMarket(cj?.market || "us");
        setCurrency(cj?.currency || "USD");

        const p = await fetch(
          `${API_BASE}/api/price/${encodeURIComponent(ticker)}?market=${encodeURIComponent(cj?.market || "us")}`,
          { cache: "no-store" }
        );
        const pj = await p.json();
        if (!alive) return;

        setPrice(Number(pj?.price));
      } catch (e) {
        if (!alive) return;
        setHeaderError(String(e?.message || e));
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [ticker]);

  /* Financial statements */
  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setFin({ loading: true, error: "", data: null });
        const r = await fetch(`${API_BASE}/api/financials/${encodeURIComponent(ticker)}`);
        const j = await r.json();
        if (!alive) return;
        setFin({ loading: false, error: "", data: j });
      } catch (e) {
        if (!alive) return;
        setFin({ loading: false, error: t("ERR_STATEMENTS"), data: null });
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [ticker, t]);

  /* Valuation (sessionStorage cached) */
  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setVal({ loading: true, error: "", data: null });

        const marketHint =
          (fin?.data && typeof fin.data.market === "string" && fin.data.market) || market || "us";

        const k = `session_val_${marketHint}_${ticker}`;
        const cached = sessionStorage.getItem(k);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (!alive) return;
          setVal({ loading: false, error: "", data: parsed });
          return;
        }

        const r = await fetch(
          `${API_BASE}/api/valuation/${encodeURIComponent(ticker)}?market=${encodeURIComponent(marketHint)}`,
          { cache: "no-store" }
        );
        const j = await r.json();
        sessionStorage.setItem(k, JSON.stringify(j));
        if (!alive) return;
        setVal({ loading: false, error: "", data: j });
      } catch (e) {
        if (!alive) return;
        setVal({ loading: false, error: t("ERR_VALUATION"), data: null });
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [ticker, fin, market, t]);

  const years = useMemo(() => fin?.data?.years || [], [fin]);
  const toSeries = (k) =>
    years
      .map((y) => ({ label: String(y.year), value: Number(y[k]) }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => Number(a.label) - Number(b.label));

  const serRevenue = useMemo(() => toSeries("revenue"), [years]);
  const serOp = useMemo(() => toSeries("operatingIncome"), [years]);
  const serNet = useMemo(() => toSeries("netIncome"), [years]);
  const serEquity = useMemo(() => toSeries("totalEquity"), [years]);
  const serFCF = useMemo(() => toSeries("freeCashFlow"), [years]);

  const fair = val?.data;
  const fairAvg = useMemo(() => {
    const arr = [fair?.fairEV, fair?.fairPS, fair?.fairPE].filter((n) => Number.isFinite(n));
    if (!arr.length) return null;
    return arr.reduce((s, n) => s + n, 0) / arr.length;
  }, [fair]);

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh" }} dir={dir} lang={lang}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        {/* Banner */}
        <div
          style={{
            background: "#111827",
            color: "#fff",
            borderRadius: 16,
            padding: 14,
            marginBottom: 16,
            boxShadow: "0 1px 10px rgba(0,0,0,0.10)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Trueprice.cash Financial Report</div>
            <div style={{ fontSize: 13, color: "#cbd5e1" }}>
              <b>{t("TICKER")}:</b> {ticker} — {company || "—"} · <b>{t("REPORT_DATE")}:</b> {reportDate}
            </div>
          </div>

          <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontWeight: 800 }}>
              {t("PRICE")}:{" "}
              {headerError ? (
                <span style={{ color: "#fecaca" }}>{headerError}</span>
              ) : price == null ? (
                t("LOADING")
              ) : (
                `${fmt2(price)} ${currency}`
              )}
            </div>
            <LangToggle lang={lang} onToggle={toggleLang} t={t} />
          </div>
        </div>

        {/* 1. Executive Summary */}
        <Card title={t("EXEC_SUM")}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>
              <li>
                <b>{t("REV_GROWTH")}:</b> {trendText(serRevenue, t)}
              </li>
              <li>
                <b>{t("OP_INCOME")}:</b> {trendText(serOp, t)}
              </li>
              <li>
                <b>{t("NET_INCOME")}:</b> {trendText(serNet, t)}
              </li>
              <li>
                <b>{t("FCF")}:</b> {trendText(serFCF, t)}
              </li>
              <li>
                <b>{t("STOCK_VALUATION")}:</b> {t("FAIR_ABBR")}_ABBR ≈ {fmt2(fairAvg)} {currency}
              </li>
            </ul>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <CompareBar current={price ?? 0} fair={fairAvg ?? 0} currency={currency} dir={dir} t={t} />
            </div>
          </div>
        </Card>

        {/* 2. Fair value section */}
        <Card title={t("FAIR_VALUE_SECTION")}>
          {val.loading ? (
            <div style={{ color: "#475569" }}>{t("LOADING")}</div>
          ) : val.error ? (
            <div style={{ color: "#b91c1c" }}>{val.error}</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div>
                  <b>{t("CUR_PRICE")}:</b> {fmt2(price)} {currency}
                </div>
                <div>
                  <b>{t("FAIR_AVG")}:</b> {fmt2(fairAvg)} {currency}
                </div>

                <div style={{ marginTop: 10, fontWeight: 900 }}>{t("VAL_METHODS")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, maxWidth: 420 }}>
                  <div>{t("EV_SHARE")}</div>
                  <div style={{ fontWeight: 800 }}>{fmt2(fair?.fairEV)} {currency}</div>

                  <div>{t("PS_BASED")}</div>
                  <div style={{ fontWeight: 800 }}>{fmt2(fair?.fairPS)} {currency}</div>

                  <div>{t("PE_BASED")}</div>
                  <div style={{ fontWeight: 800 }}>{fmt2(fair?.fairPE)} {currency}</div>

                  <div>{t("EQUITY_PER_SHARE")}</div>
                  <div style={{ fontWeight: 800 }}>{fmt2(fair?.equityPerShare)} {currency}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <CompareBar current={price ?? 0} fair={fairAvg ?? 0} currency={currency} dir={dir} t={t} />
              </div>
            </div>
          )}
        </Card>

        {/* 3. Revenue & Income */}
        <Card title={t("REV_INC_TITLE")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            <ChartBlock title={t("REVENUE")} series={serRevenue} dir={dir} t={t} />
            <ChartBlock title={t("OP_INCOME")} series={serOp} dir={dir} t={t} />
            <ChartBlock title={t("NET_INCOME")} series={serNet} dir={dir} t={t} />
          </div>
        </Card>

        {/* 4. Equity & FCF */}
        <Card title={t("EQUITY_FCF_TITLE")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
            <ChartBlock title={t("TOTAL_EQUITY")} series={serEquity} w={480} dir={dir} t={t} />
            <ChartBlock title={t("FCF")} series={serFCF} w={480} dir={dir} t={t} />
          </div>
        </Card>

        {/* Appendix */}
        <Card title={t("APPENDIX")}>
          {fin.loading ? (
            <div style={{ color: "#475569" }}>{t("LOADING")}</div>
          ) : fin.error ? (
            <div style={{ color: "#b91c1c" }}>{fin.error}</div>
          ) : !years.length ? (
            <div style={{ color: "#475569" }}>{t("NO_DATA")}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ textAlign: "start", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{t("YEAR")}</th>
                    <th style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{t("REVENUE")}</th>
                    <th style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{t("OP_INCOME")}</th>
                    <th style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{t("NET_INCOME")}</th>
                    <th style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{t("TOTAL_EQUITY")}</th>
                    <th style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{t("FCF")}</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.year}>
                      <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>{y.year}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9" }}>{fmtBill(y.revenue)}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9" }}>{fmtBill(y.operatingIncome)}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9" }}>{fmtBill(y.netIncome)}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9" }}>{fmtBill(y.totalEquity)}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9" }}>{fmtBill(y.freeCashFlow)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
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
  );
}

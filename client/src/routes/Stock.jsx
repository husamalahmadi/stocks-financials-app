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

/* UI */
function Card({ title, children, style }) {
  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", marginBottom: 16, ...style }}>
      {title && <header style={{ padding: "10px 14px", borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>{title}</header>}
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
      style={{ border: "1px solid #d1d5db", borderRadius: 999, padding: "6px 10px", fontWeight: 700, background: active ? "#111827" : "#f3f4f6", color: active ? "#fff" : "#111827", cursor: "pointer" }}
    >
      {active ? t("AR") : t("EN")}
    </button>
  );
}

const fmt2 = (n) => Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
function fmtBill(n) {
  if (!Number.isFinite(+n)) return "—";
  const abs = Math.abs(+n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
  return fmt2(n);
}

function CompareBar({ current, fair, currency, dir = "ltr", t }) {
  const max = Math.max(current || 0, fair || 0, 1);
  const w = 300, h = 10;
  const cW = Math.round(((current || 0) / max) * w);
  const fW = Math.round(((fair || 0) / max) * w);
  return (
    <div style={{ display: "grid", gap: 6, direction: dir }}>
      <div style={{ position: "relative", width: w, height: h, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: cW, height: "100%", background: "#3b82f6" }} />
        <div style={{ width: 2, height: "100%", background: "#10b981", position: "absolute", left: fW - 1, top: 0 }} title={t("FAIR_AVG")} />
      </div>
      <div style={{ display: "grid", gap: 2, fontSize: 12, color: "#374151" }}>
        <span>{t("CUR_PRICE")}: <b>{fmt2(current)} {currency}</b></span>
        <span>{t("FAIR_AVG")}: <b>{fmt2(fair)} {currency}</b></span>
      </div>
    </div>
  );
}

function LineChart({ title, series, w = 380, dir = "ltr" }) {
  const data = (series || []).filter(p => Number.isFinite(p.value)).sort((a,b)=>Number(a.label)-Number(b.label));
  const h = 220, pad = { t: 22, r: 18, b: 28, l: 56 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  if (!data.length) return <div style={{ fontSize: 12, color: "#6b7280" }}>{title}: —</div>;
  const xs = i => pad.l + (i * iw) / Math.max(1, data.length - 1);
  const vals = data.map(d=>d.value); let min=Math.min(...vals), max=Math.max(...vals);
  if (min===max) { const d=Math.abs(min||1)*0.1; min-=d; max+=d; }
  const ys = v => pad.t + (1 - (v - min)/(max - min)) * ih;
  const dAttr = data.map((p,i)=>(i?'L':'M')+' '+xs(i)+' '+ys(p.value)).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", display: "block" }} direction={dir}>
      <text x={w/2} y={16} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700 }}>{title}</text>
      <line x1={pad.l} y1={h-pad.b} x2={w-pad.r} y2={h-pad.b} stroke="#e5e7eb" />
      <path d={dAttr} fill="none" stroke="#0f4a5a" strokeWidth="2" />
      {data.map((p,i)=>(
        <g key={p.label+i}>
          <circle cx={xs(i)} cy={ys(p.value)} r="3.5" fill="#0f4a5a" />
          <text x={xs(i)} y={h-pad.b+16} textAnchor="middle" style={{ fontSize: 10, fill: "#6b7280" }}>{p.label}</text>
        </g>
      ))}
    </svg>
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

  const [fin, setFin] = useState({ loading: true, data: null, error: "" });
  const [val, setVal] = useState({ loading: true, data: null, error: "" });

  const reportDate = useMemo(() => {
    const d = new Date();
    return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}/${d.getFullYear()}`;
  }, []);

  // company + price
  useEffect(() => {
    let cancel = false;
    (async () => {
      setHeaderError(""); setCompany(""); setMarket("us"); setCurrency("USD"); setPrice(null);
      try {
        const cRes = await fetch(`${API_BASE}/api/company/${encodeURIComponent(ticker)}`);
        if (!cRes.ok) throw new Error("company lookup failed");
        const c = await cRes.json();
        if (cancel) return;
        setCompany(c.name || ""); setMarket(c.market || "us"); setCurrency(c.currency || "USD");

        const pRes = await fetch(`${API_BASE}/api/price/${encodeURIComponent(ticker)}?market=${encodeURIComponent(c.market)}`, { cache: "no-store" });
        const p = await pRes.json();
        if (!cancel) setPrice(Number.isFinite(+p.price) ? +p.price : null);
      } catch (e) { if (!cancel) setHeaderError(e?.message || "header load failed"); }
    })();
    return () => { cancel = true; };
  }, [ticker]);

  // financials
  useEffect(() => {
    let cancel = false;
    (async () => {
      setFin({ loading: true, data: null, error: "" });
      try {
        const res = await fetch(`${API_BASE}/api/financials/${encodeURIComponent(ticker)}`);
        const j = await res.json();
        if (!cancel) setFin({ loading: false, data: j, error: "" });
      } catch (e) { if (!cancel) setFin({ loading: false, data: null, error: t("ERR_STATEMENTS") }); }
    })();
    return () => { cancel = true; };
  }, [ticker, t]);

  // valuation (session cache)
  useEffect(() => {
    let cancel = false;
    (async () => {
      setVal({ loading: true, data: null, error: "" });
      try {
        const k = `session_val_${market}_${ticker}`;
        const cached = sessionStorage.getItem(k);
        if (cached) { const j = JSON.parse(cached); if (!cancel) { setVal({ loading:false, data:j, error:"" }); return; } }
        const res = await fetch(`${API_BASE}/api/valuation/${encodeURIComponent(ticker)}?market=${encodeURIComponent(market)}`, { cache: "no-store" });
        const j = await res.json();
        if (!cancel) { try { sessionStorage.setItem(k, JSON.stringify(j)); } catch {} setVal({ loading:false, data:j, error:"" }); }
      } catch (e) { if (!cancel) setVal({ loading:false, data:null, error: t("ERR_VALUATION") }); }
    })();
    return () => { cancel = true; };
  }, [ticker, market, t]);

  // series
  const years = useMemo(()=>fin?.data?.years || [], [fin]);
  const toSeries = (k)=> years.map(y=>({ label:String(y.year), value:Number(y[k]) }))
                              .filter(p=>Number.isFinite(p.value))
                              .sort((a,b)=>Number(a.label)-Number(b.label));
  const serRevenue = useMemo(()=>toSeries("revenue"), [years]);
  const serOp      = useMemo(()=>toSeries("operatingIncome"), [years]);
  const serNet     = useMemo(()=>toSeries("netIncome"), [years]);
  const serEquity  = useMemo(()=>toSeries("totalEquity"), [years]);
  const serFCF     = useMemo(()=>toSeries("freeCashFlow"), [years]);

  // summary text
  const pctText = (series) => {
    if (!series.length) return t("NO_DATA");
    const a = series[0].value, b = series[series.length-1].value;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return t("NO_DATA");
    const chg = ((b - a) / Math.max(Math.abs(a), 1)) * 100;
    const dirWord = chg > 0 ? t("UP") : chg < 0 ? t("DOWN") : t("FLAT");
    return `${dirWord} ~ ${fmt2(Math.abs(chg))}%`;
    // why: match bullet style in both languages
  };

  const fair = val?.data;
  const fairAvg = useMemo(() => {
    const arr = [fair?.fairEV, fair?.fairPS, fair?.fairPE].filter((n) => Number.isFinite(n));
    if (!arr.length) return null;
    return arr.reduce((s, n) => s + n, 0) / arr.length;
  }, [fair]);

  return (
    <div style={{ padding: 20, background: "#f8fafc", minHeight: "100vh" }} dir={dir}>
      {/* Banner */}
      <div style={{ background:"#111827", color:"#fff", borderRadius:12, padding:"16px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{t("REPORT")}</div>
        <div style={{ display:"flex", gap:18, alignItems:"baseline" }}>
          <div><b>{t("TICKER")}:</b> {ticker} — {company || "—"}</div>
          <div><b>{t("REPORT_DATE")}:</b> {reportDate}</div>
        </div>
        <div style={{ marginInlineStart:"auto", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontWeight:700 }}>
            {t("PRICE")}: {headerError ? <span style={{ color:"#fecaca" }}>{t("N_A")}</span> : price==null ? t("LOADING") : `${fmt2(price)} ${currency}`}
          </div>
          <LangToggle lang={lang} onToggle={toggleLang} t={t} />
        </div>
      </div>

      {/* 1. Executive Summary */}
      <Card title={t("EXEC_SUM")}>
        <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:16 }}>
          <ul style={{ margin:0, paddingInlineStart:18 }}>
            <li><b>{t("REV_GROWTH")}:</b> {pctText(serRevenue)}</li>
            <li><b>{t("OP_INCOME")}:</b> {pctText(serOp)}</li>
            <li><b>{t("NET_INCOME")}:</b> {pctText(serNet)}</li>
            <li><b>{t("FCF")}:</b> {pctText(serFCF)}</li>
            <li><b>{t("STOCK_VALUATION")}:</b> {fairAvg==null ? "—" : `${t("FAIR_ABBR")} ≈ ${fmt2(fairAvg)} ${currency}`}</li>
          </ul>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end" }}>
            <CompareBar current={price ?? 0} fair={fairAvg ?? 0} currency={currency} dir={dir} t={t} />
          </div>
        </div>
      </Card>

      {/* 2. Fair Value */}
      <Card title={t("FAIR_VALUE_SECTION")}>
        {val.loading && <div>{t("LOADING")}</div>}
        {val.error && <div style={{ color:"#b91c1c" }}>{t("ERR_VALUATION")}</div>}
        {!val.loading && !val.error && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, alignItems:"center" }}>
            <div style={{ display:"grid", gap:8 }}>
              <div><b>{t("CUR_PRICE")}:</b> {fmt2(price)} {currency}</div>
              <div><b>{t("FAIR_AVG")}:</b> {fairAvg==null ? "—" : `${fmt2(fairAvg)} ${currency}`}</div>
              <div style={{ marginTop:8 }}>
                <div style={{ fontWeight:700, marginBottom:6 }}>{t("VAL_METHODS")}</div>
                <div style={{ display:"grid", gap:6, gridTemplateColumns:"auto 1fr" }}>
                  <div>{t("EV_SHARE")}</div><div style={{ fontWeight:700 }}>{fmt2(fair?.fairEV)} {currency}</div>
                  <div>{t("PS_BASED")}</div><div style={{ fontWeight:700 }}>{fmt2(fair?.fairPS)} {currency}</div>
                  <div>{t("PE_BASED")}</div><div style={{ fontWeight:700 }}>{fmt2(fair?.fairPE)} {currency}</div>
                  <div>{t("EQUITY_PER_SHARE")}</div><div style={{ fontWeight:700 }}>{fmt2(fair?.equityPerShare)} {currency}</div>
                </div>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <CompareBar current={price ?? 0} fair={fairAvg ?? 0} currency={currency} dir={dir} t={t} />
            </div>
          </div>
        )}
      </Card>

      {/* 3. Revenue & Income */}
      <Card title={t("REV_INC_TITLE")}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0,1fr))", gap:12 }}>
          <LineChart title={t("REVENUE")}       series={serRevenue} dir={dir} />
          <LineChart title={t("OP_INCOME")}     series={serOp}      dir={dir} />
          <LineChart title={t("NET_INCOME")}    series={serNet}     dir={dir} />
        </div>
      </Card>

      {/* 4. Equity & FCF */}
      <Card title={t("EQUITY_FCF_TITLE")}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0,1fr))", gap:12 }}>
          <LineChart title={t("TOTAL_EQUITY")} series={serEquity}  w={480} dir={dir} />
          <LineChart title={t("FCF")}          series={serFCF}     w={480} dir={dir} />
        </div>
      </Card>

      {/* Appendix */}
      <Card title={t("APPENDIX")} style={{ width:"100%" }}>
        {fin.loading && <div>{t("LOADING")}</div>}
        {fin.error   && <div style={{ color:"#b91c1c" }}>{fin.error}</div>}
        {!fin.loading && !fin.error && (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign:"start", padding:8 }}>{t("YEAR")}</th>
                  <th style={{ textAlign:"end",   padding:8 }}>{t("REVENUE")}</th>
                  <th style={{ textAlign:"end",   padding:8 }}>{t("OP_INCOME")}</th>
                  <th style={{ textAlign:"end",   padding:8 }}>{t("NET_INCOME")}</th>
                  <th style={{ textAlign:"end",   padding:8 }}>{t("TOTAL_EQUITY")}</th>
                  <th style={{ textAlign:"end",   padding:8 }}>{t("FCF")}</th>
                </tr>
              </thead>
              <tbody>
                {(years||[]).map(y=>(
                  <tr key={y.year}>
                    <td style={{ padding:8 }}>{y.year}</td>
                    <td style={{ textAlign:"end", padding:8 }}>{fmtBill(y.revenue)}</td>
                    <td style={{ textAlign:"end", padding:8 }}>{fmtBill(y.operatingIncome)}</td>
                    <td style={{ textAlign:"end", padding:8 }}>{fmtBill(y.netIncome)}</td>
                    <td style={{ textAlign:"end", padding:8 }}>{fmtBill(y.totalEquity)}</td>
                    <td style={{ textAlign:"end", padding:8 }}>{fmtBill(y.freeCashFlow)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

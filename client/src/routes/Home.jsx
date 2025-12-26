// FILE: client/src/routes/Home.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n.jsx";

/* -------- API base (self-contained) -------- */
function getApiBase() {
  const env = (import.meta.env.VITE_API_BASE || "").trim();
  if (env) return env.replace(/\/+$/, "");
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3000`;
  }
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
const API_BASE = getApiBase();

/* -------- Small UI helpers -------- */
function Card({ title, children, style }) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
        ...style,
      }}
    >
      {title ? <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div> : null}
      {children}
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
        background: active ? "#111827" : "#f3f4f6",
        color: active ? "#fff" : "#111827",
        cursor: "pointer",
      }}
    >
      {active ? t("AR") : t("EN")}
    </button>
  );
}

function MarketToggle({ value, onChange, t }) {
  return (
    <div
      role="group"
      aria-label="Market toggle"
      style={{
        display: "inline-flex",
        border: "1px solid #374151",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {[
        { key: "us", label: t("MARKET_US") },
        { key: "sa", label: t("MARKET_SA") },
      ].map((opt, i) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              padding: "6px 10px",
              fontWeight: 700,
              background: active ? "#111827" : "#fff",
              color: active ? "#fff" : "#111827",
              border: "none",
              borderLeft: i === 1 ? "1px solid #374151" : "none",
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StockTile({ item, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "start",
        padding: 14,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#fff",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 800 }}>{item.ticker}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{item.exchange}</div>
      </div>
      <div style={{ marginTop: 6, fontSize: 13 }}>{item.name}</div>
      {item.industry && (
        <div
          style={{
            marginTop: 8,
            display: "inline-block",
            fontSize: 11,
            color: "#111827",
            background: "#f3f4f6",
            borderRadius: 999,
            padding: "2px 8px",
            opacity: 0.85,
          }}
        >
          {item.industry}
        </div>
      )}
    </button>
  );
}

/* -------- Page -------- */
export default function Home() {
  const navigate = useNavigate();
  const { t, lang, dir, toggleLang } = useI18n();

  const [market, setMarket] = useState("us");
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const url = `${API_BASE}/api/stocks?market=${market}`;
        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${res.statusText} ${text ? `- ${text}` : ""}`.trim());
        }
        const json = await res.json();
        if (cancel) return;
        setItems(json.items || []);
        setIndustries(json.industries || []);
      } catch (e) {
        console.error("[Home.jsx] stocks:", e);
        if (!cancel) setError(`${t("ERR_LOAD_STOCKS")} (${e.message || e})`);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [market, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (industry && it.industry !== industry) return false;
      if (!q) return true;
      return (
        it.ticker.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        (it.industry || "").toLowerCase().includes(q)
      );
    });
  }, [items, query, industry]);

  return (
    <div style={{ padding: 20, background: "#f8fafc", minHeight: "100vh" }} dir={dir}>
      {/* Header */}
      <div
        style={{
          background: "#111827",
          color: "#fff",
          borderRadius: 12,
          padding: "16px 18px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, flex: "0 0 auto" }}>{t("DASHBOARD")}</div>
        <div style={{ marginInlineStart: "auto", display: "flex", gap: 10 }}>
          <LangToggle lang={lang} onToggle={toggleLang} t={t} />
        </div>
      </div>

      {/* Filters */}
      <Card title={t("FILTERS")}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <MarketToggle value={market} onChange={setMarket} t={t} />

          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
            }}
          >
            <option value="">{t("INDUSTRY_ALL")}</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("SEARCH_PLACEHOLDER")}
            style={{
              flex: "1 1 240px",
              minWidth: 200,
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
            }}
          />

          <button
            onClick={() => {
              setQuery("");
              setIndustry("");
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            {t("RESET")}
          </button>
        </div>
      </Card>

      {/* Results */}
      <Card title={t("COMPANIES")}>
        {loading && <div>{t("LOADING")}</div>}
        {error && <div style={{ color: "#b91c1c", whiteSpace: "pre-wrap" }}>{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ color: "#6b7280" }}>{t("NO_MATCH")}</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              marginTop: 8,
            }}
          >
            {filtered.map((it) => (
              <StockTile
                key={`${it.ticker}_${it.name}`}
                item={it}
                onClick={() => navigate(`/stock/${encodeURIComponent(it.ticker)}`)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

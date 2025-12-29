// FILE: client/src/routes/Home.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

function normalize(s) {
  return (s || "").toString().trim().toLowerCase();
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

function MarketToggle({ value, onChange, t }) {
  const opt = [
    { v: "us", label: t("MARKET_US") },
    { v: "sa", label: t("MARKET_SA") },
  ];
  return (
    <div
      role="group"
      aria-label="Market toggle"
      style={{
        display: "inline-flex",
        border: "1px solid #d1d5db",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {opt.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          style={{
            padding: "10px 12px",
            border: "none",
            cursor: "pointer",
            background: value === o.v ? "#111827" : "#fff",
            color: value === o.v ? "#fff" : "#111827",
            fontWeight: 800,
            fontSize: 12,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const { t, lang, dir, toggleLang } = useI18n();
  const navigate = useNavigate();

  const [market, setMarket] = useState("us");
  const [industry, setIndustry] = useState("all");
  const [q, setQ] = useState("");

  const [state, setState] = useState({
    loading: true,
    error: "",
    items: [],
    industries: [],
    source: "",
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setState((s) => ({ ...s, loading: true, error: "" }));
        const r = await fetch(`${API_BASE}/api/stocks?market=${encodeURIComponent(market)}`);
        if (!r.ok) throw new Error(`${t("ERR_LOAD_STOCKS")} (HTTP ${r.status})`);
        const j = await r.json();
        if (!alive) return;

        setState({
          loading: false,
          error: "",
          items: Array.isArray(j?.items) ? j.items : [],
          industries: Array.isArray(j?.industries) ? j.industries : [],
          source: j?.source || "",
        });

        setIndustry("all");
        setQ("");
      } catch (e) {
        if (!alive) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e?.message || t("ERR_LOAD_STOCKS"),
        }));
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [market, t]);

  const industryOptions = useMemo(() => {
    const unique = Array.from(new Set((state.industries || []).filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [state.industries]);

  const filtered = useMemo(() => {
    const query = normalize(q);
    const wantIndustry = industry !== "all" ? industry : "";
    const items = Array.isArray(state.items) ? state.items : [];

    return items.filter((it) => {
      const name = normalize(it?.name);
      const ticker = normalize(it?.ticker);
      const ind = (it?.industry || "").toString();

      const matchesQuery =
        !query || name.includes(query) || ticker.includes(query) || ind.toLowerCase().includes(query);

      const matchesIndustry = !wantIndustry || ind === wantIndustry;

      return matchesQuery && matchesIndustry;
    });
  }, [state.items, q, industry]);

  return (
    <div dir={dir} lang={lang} style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        {/* Header (dark like Stock page) */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            padding: 14,
            borderRadius: 16,
            background: "#111827",
            color: "#fff",
            boxShadow: "0 1px 10px rgba(0,0,0,0.08)",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{t("DASHBOARD")}</div>
            <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 2 }}>
              {market === "us" ? t("MARKET_US") : t("MARKET_SA")}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link
              to="/contact"
              aria-label={t("CONTACT_US")}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 999,
                padding: "6px 10px",
                fontWeight: 700,
                background: "#fff",
                color: "#111827",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {t("CONTACT_US")}
            </Link>

            <LangToggle lang={lang} onToggle={toggleLang} t={t} />
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            marginTop: 16,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 14,
            boxShadow: "0 1px 10px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 10, color: "#111827" }}>{t("FILTERS")}</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
              alignItems: "end",
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#475569" }}>{t("MARKET")}</span>
              <MarketToggle value={market} onChange={setMarket} t={t} />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#475569" }}>{t("INDUSTRY")}</span>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid #d1d5db",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: "#fff",
                }}
              >
                <option value="all">{t("INDUSTRY_ALL")}</option>
                {industryOptions.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#475569" }}>{t("SEARCH")}</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("SEARCH_PLACEHOLDER")}
                style={{
                  width: "100%",
                  border: "1px solid #d1d5db",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: "#fff",
                }}
              />
            </label>

            <button
              onClick={() => {
                setIndustry("all");
                setQ("");
              }}
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: 12,
                padding: "10px 12px",
                background: "#f3f4f6",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              {t("RESET")}
            </button>
          </div>
        </div>

        {/* Results */}
        <div
          style={{
            marginTop: 16,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 14,
            boxShadow: "0 1px 10px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontWeight: 900, color: "#111827" }}>
            {t("COMPANIES")} ({filtered.length})
          </div>

          {state.loading ? (
            <div style={{ padding: 14, color: "#475569" }}>{t("LOADING")}</div>
          ) : state.error ? (
            <div style={{ padding: 14, color: "#b91c1c" }}>{state.error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 14, color: "#475569" }}>{t("NO_RESULTS")}</div>
          ) : (
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              {filtered.map((it) => (
                <button
                  key={`${it.market || market}_${it.ticker}`}
                  onClick={() => navigate(`/stock/${encodeURIComponent(it.ticker)}`)}
                  style={{
                    textAlign: "start",
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: 14,
                    background: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 1px 10px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                    {it.name || it.ticker}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                    <span style={{ fontWeight: 900, color: "#111827" }}>{t("TICKER")}:</span> {it.ticker}
                    {it.industry ? (
                      <>
                        {" "}
                        · <span style={{ fontWeight: 900, color: "#111827" }}>{t("INDUSTRY")}:</span> {it.industry}
                      </>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

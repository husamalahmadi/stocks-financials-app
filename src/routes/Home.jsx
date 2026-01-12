
// FILE: client/src/routes/Home.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { getStocks } from "../data/stocksCatalog.js";

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
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {lang === "en" ? t("EN") : t("AR")}
    </button>
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
  });

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setState((s) => ({ ...s, loading: true, error: "" }));

        const json = await getStocks({ market });
        if (!alive) return;

        setState({
          loading: false,
          error: "",
          items: json?.items || [],
          industries: json?.industries || [],
        });
      } catch (e) {
        if (!alive) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: t("ERR_LOAD_STOCKS"),
          items: [],
          industries: [],
        }));
      }
    }

    run();
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
      const indNorm = normalize(ind);

      const matchesQuery =
        !query ||
        name.includes(query) ||
        ticker.includes(query) ||
        indNorm.includes(query);

      const matchesIndustry = !wantIndustry || ind === wantIndustry;

      return matchesQuery && matchesIndustry;
    });
  }, [state.items, industry, q]);

  function resetFilters() {
    setIndustry("all");
    setQ("");
  }

  function goToStock(ticker) {
    navigate(`/stock/${encodeURIComponent(ticker)}`);
  }

  return (
    <div dir={dir} lang={lang} style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        {/* Header (dark like Stock) */}
        <div
          style={{
            borderRadius: 18,
            background: "linear-gradient(180deg, #0f172a, #111827)",
            padding: "14px 16px",
            color: "#fff",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Trueprice.cash</div>
            <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 2 }}>
              {market === "us" ? t("MARKET_US") : t("MARKET_SA")}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginInlineStart: "auto" }}>
            <Link
              to="/about"
              aria-label={t("ABOUT_US")}
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
              {t("ABOUT_US")}
            </Link>

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
          <div style={{ fontWeight: 900, marginBottom: 10 }}>{t("FILTERS")}</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1.3fr",
              gap: 12,
              alignItems: "end",
            }}
          >
            {/* Market */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 6 }}>
                {t("MARKET")}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setMarket("us")}
                  style={{
                    flex: 1,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: market === "us" ? "#0f172a" : "#fff",
                    color: market === "us" ? "#fff" : "#0f172a",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {t("MARKET_US")}
                </button>
                <button
                  onClick={() => setMarket("sa")}
                  style={{
                    flex: 1,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: market === "sa" ? "#0f172a" : "#fff",
                    color: market === "sa" ? "#fff" : "#0f172a",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {t("MARKET_SA")}
                </button>
              </div>
            </div>

            {/* Industry */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 6 }}>
                {t("INDUSTRY")}
              </div>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: "#fff",
                  fontWeight: 700,
                }}
              >
                <option value="all">{t("INDUSTRY_ALL")}</option>
                {industryOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 6 }}>
                {t("SEARCH")}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("SEARCH_PLACEHOLDER")}
                  style={{
                    flex: 1,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "#fff",
                    fontWeight: 600,
                  }}
                />
                <button
                  onClick={resetFilters}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "10px 14px",
                    background: "#f8fafc",
                    fontWeight: 800,
                    cursor: "pointer",
                    minWidth: 96,
                  }}
                >
                  {t("RESET")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Companies */}
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
          <div style={{ fontWeight: 900, marginBottom: 10 }}>
            {t("COMPANIES")} ({filtered.length})
          </div>

          {state.loading ? (
            <div style={{ color: "#64748b" }}>{t("LOADING")}</div>
          ) : state.error ? (
            <div style={{ color: "#b91c1c" }}>{state.error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: "#64748b" }}>{t("NO_MATCH")}</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              {filtered.map((it) => (
                <button
                  key={`${it.ticker}-${it.market || market}`}
                  onClick={() => goToStock(it.ticker)}
                  style={{
                    textAlign: "start",
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 12,
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>{it.name}</div>
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

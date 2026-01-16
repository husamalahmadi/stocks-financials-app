// FILE: src/routes/Home.jsx
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
      className="tp-pill tp-pill--lang"
      type="button"
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
      {/* Responsive fixes */}
      <style>{`
        /* Global guardrails to prevent overflow on mobile */
        .tp-wrap, .tp-card, .tp-header, .tp-filters, .tp-companies { box-sizing: border-box; }
        .tp-wrap * { box-sizing: border-box; }
        .tp-wrap { max-width: 1100px; margin: 0 auto; padding: 16px; }
        .tp-card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:14px; box-shadow:0 1px 10px rgba(0,0,0,0.04); }
        .tp-title { font-weight:900; margin-bottom:10px; }
        .tp-muted { color:#64748b; }
        .tp-danger { color:#b91c1c; }

        /* Header */
        .tp-header {
          border-radius: 18px;
          background: linear-gradient(180deg, #0f172a, #111827);
          padding: 14px 16px;
          color: #fff;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap; /* critical */
          min-width: 0;
        }
        .tp-brand { min-width: 0; }
        .tp-brand h1 { margin:0; font-size:18px; font-weight:900; }
        .tp-brand p { margin:2px 0 0; font-size:13px; color:#cbd5e1; }

        .tp-actions {
          margin-inline-start: auto;
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap; /* critical */
          justify-content: flex-end;
          min-width: 0;
        }

        /* Pills (About/Contact/Lang) */
        .tp-pill {
          border: 1px solid #d1d5db;
          border-radius: 999px;
          padding: 6px 10px;
          font-weight: 700;
          background: #fff;
          color: #111827;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          white-space: nowrap;
          max-width: 100%;
        }
        .tp-pill--lang { gap: 8px; }

        /* Filters layout */
        .tp-filters { margin-top: 16px; }
        .tp-filters-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1.3fr;
          gap: 12px;
          align-items: end;
          min-width: 0;
        }
        .tp-label { font-size: 12px; font-weight: 800; color: #334155; margin-bottom: 6px; }

        .tp-market-row { display:flex; gap:10px; min-width:0; flex-wrap:wrap; }
        .tp-market-btn {
          flex: 1;
          min-width: 140px; /* allows wrap instead of overflow */
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 800;
          cursor: pointer;
          max-width: 100%;
        }
        .tp-market-btn--active { background:#0f172a; color:#fff; }
        .tp-market-btn--idle { background:#fff; color:#0f172a; }

        .tp-select, .tp-input {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 10px 12px;
          background: #fff;
          font-weight: 700;
          max-width: 100%;
          min-width: 0; /* critical */
        }
        .tp-input { font-weight: 600; }

        .tp-search-row { display:flex; gap:10px; min-width:0; flex-wrap:wrap; }
        .tp-reset-btn {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 10px 14px;
          background: #f8fafc;
          font-weight: 800;
          cursor: pointer;
          min-width: 96px;
          max-width: 100%;
        }

        /* Companies grid */
        .tp-companies { margin-top: 16px; }
        .tp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
          min-width: 0;
        }
        .tp-company {
          text-align: start;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 12px;
          background: #fff;
          cursor: pointer;
          max-width: 100%;
          min-width: 0;
        }
        .tp-company-name { font-weight: 900; color:#0f172a; }
        .tp-company-meta { font-size:12px; color:#64748b; margin-top:6px; line-height: 1.35; }
        .tp-strong { font-weight:900; color:#111827; }

        /* Mobile rules (fix overflow) */
        @media (max-width: 820px) {
          .tp-filters-grid { grid-template-columns: 1fr; }
          .tp-search-row { flex-direction: column; }
          .tp-reset-btn { width: 100%; min-width: 0; }
          .tp-market-btn { min-width: 0; }
        }
        @media (max-width: 520px) {
          .tp-wrap { padding: 12px; }
          .tp-header { align-items: stretch; }
          .tp-actions { width: 100%; justify-content: space-between; }
          .tp-pill { flex: 1; }
          .tp-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="tp-wrap">
        {/* Header */}
        <div className="tp-header">
          <div className="tp-brand">
            <h1>Trueprice.cash</h1>
            <p>{market === "us" ? t("MARKET_US") : t("MARKET_SA")}</p>
          </div>

          <div className="tp-actions">
            <Link to="/about" aria-label={t("ABOUT_US")} className="tp-pill">
              {t("ABOUT_US")}
            </Link>

            <Link to="/contact" aria-label={t("CONTACT_US")} className="tp-pill">
              {t("CONTACT_US")}
            </Link>

            <LangToggle lang={lang} onToggle={toggleLang} t={t} />
          </div>
        </div>

        {/* Filters */}
        <div className="tp-card tp-filters">
          <div className="tp-title">{t("FILTERS")}</div>

          <div className="tp-filters-grid">
            {/* Market */}
            <div>
              <div className="tp-label">{t("MARKET")}</div>
              <div className="tp-market-row">
                <button
                  type="button"
                  onClick={() => setMarket("us")}
                  className={`tp-market-btn ${market === "us" ? "tp-market-btn--active" : "tp-market-btn--idle"}`}
                >
                  {t("MARKET_US")}
                </button>
                <button
                  type="button"
                  onClick={() => setMarket("sa")}
                  className={`tp-market-btn ${market === "sa" ? "tp-market-btn--active" : "tp-market-btn--idle"}`}
                >
                  {t("MARKET_SA")}
                </button>
              </div>
            </div>

            {/* Industry */}
            <div>
              <div className="tp-label">{t("INDUSTRY")}</div>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="tp-select"
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
              <div className="tp-label">{t("SEARCH")}</div>
              <div className="tp-search-row">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("SEARCH_PLACEHOLDER")}
                  className="tp-input"
                />
                <button type="button" onClick={resetFilters} className="tp-reset-btn">
                  {t("RESET")}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Companies */}
        <div className="tp-card tp-companies">
          <div className="tp-title">
            {t("COMPANIES")} ({filtered.length})
          </div>

          {state.loading ? (
            <div className="tp-muted">{t("LOADING")}</div>
          ) : state.error ? (
            <div className="tp-danger">{state.error}</div>
          ) : filtered.length === 0 ? (
            <div className="tp-muted">{t("NO_MATCH")}</div>
          ) : (
            <div className="tp-grid">
              {filtered.map((it) => (
                <button
                  key={`${it.ticker}-${it.market || market}`}
                  onClick={() => goToStock(it.ticker)}
                  className="tp-company"
                  type="button"
                >
                  <div className="tp-company-name">{it.name}</div>
                  <div className="tp-company-meta">
                    <span className="tp-strong">{t("TICKER")}:</span> {it.ticker}
                    {it.industry ? (
                      <>
                        {" "}
                        · <span className="tp-strong">{t("INDUSTRY")}:</span> {it.industry}
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

import React, { useEffect, useState } from "react";
import { fetchStockNews } from "../services/googleNewsRss.js";

export function StockNewsSidebar({ ticker, companyName = "", market = "us", t, dir, isMobile = false }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadNews = React.useCallback(() => {
    if (!ticker) {
      setArticles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setArticles([]);

    let alive = true;
    fetchStockNews({ ticker, companyName, market })
      .then((list) => {
        if (alive) {
          setArticles(list);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) {
          setError(String(e?.message || e));
          setArticles([]);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [ticker, companyName, market]);

  useEffect(() => {
    loadNews();
  }, [loadNews, refreshKey]);

  const formatDate = (d) => {
    if (!d) return "";
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <aside
      className="no-print"
      style={{
        width: isMobile ? "100%" : 280,
        flexShrink: 0,
        alignSelf: isMobile ? "stretch" : "flex-start",
        position: isMobile ? "relative" : "sticky",
        top: isMobile ? undefined : 16,
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        boxShadow: "0 1px 10px rgba(0,0,0,0.10)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "#111827",
          color: "#fff",
          fontSize: 18,
          fontWeight: 900,
          padding: "14px 14px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>{t("NEWS_SIDEBAR_TITLE")}</span>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.5)",
            color: "#fff",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {t("NEWS_REFRESH")}
        </button>
      </div>
      <div style={{ maxHeight: 560, overflowY: "auto", padding: 10 }}>
        {loading ? (
          <div style={{ color: "#64748b", fontSize: 13, padding: 8 }}>{t("LOADING")}</div>
        ) : error ? (
          <div style={{ color: "#b91c1c", fontSize: 13, padding: 8 }}>
            {t("NEWS_FETCH_ERROR")}
            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.9 }}>{error}</div>
          </div>
        ) : articles.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 13, padding: 8 }}>{t("NEWS_NO_ARTICLES")}</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {articles.map((a, i) => (
              <li key={i}>
                <a
                  href={a.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "#f8fafc",
                    color: "#1e293b",
                    textDecoration: "none",
                    fontSize: 13,
                    lineHeight: 1.4,
                    border: "1px solid #e5e7eb",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "#eff6ff";
                    e.currentTarget.style.borderColor = "#93c5fd";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "#f8fafc";
                    e.currentTarget.style.borderColor = "#e5e7eb";
                  }}
                >
                  <span style={{ fontWeight: 600, overflowWrap: "break-word" }}>{a.title}</span>
                  {a.date && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "#64748b" }}>
                      {formatDate(a.date)}
                      {a.source ? ` · ${a.source}` : ""}
                    </div>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

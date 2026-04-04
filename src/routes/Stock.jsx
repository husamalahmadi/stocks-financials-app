import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useI18n } from "../i18n.jsx";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { getCompany, getStocks, resolveMarketAndSymbol } from "../data/stocksCatalog.js";
import { getLivePrice } from "../services/priceService.js";
import { getFinancialsCached } from "../services/financialsService.js";
import { computeValuation } from "../domain/valuation.js";
import { twelveLogo, twelveProfile } from "../services/twelveData.js";
import { translateToArabic } from "../services/translateService.js";
import { Card } from "../components/Card.jsx";
import { PillLink } from "../components/PillLink.jsx";
import { LangToggle } from "../components/LangToggle.jsx";
import { RetryButton } from "../components/RetryButton.jsx";
import { CompareBar, ChartBlock } from "../components/stock/StockCharts.jsx";
import { StockNewsSidebar } from "../components/StockNewsSidebar.jsx";
import { fmt2, fmtBill, trendText, calcTrend } from "../domain/formatting.js";
import { usePageMeta } from "../hooks/usePageMeta.js";
import { useFavorites } from "../hooks/useFavorites.js";
import { getPrefetchDelayMs } from "../config/env.js";
import { exportElementAsPdf } from "../utils/exportPdf.js";

const PREFETCH_DELAY_SEC = Math.ceil(getPrefetchDelayMs() / 1000);

/* Page */
export default function Stock() {
  const { ticker } = useParams();
  const { t, lang, dir, toggleLang } = useI18n();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [shareCopied, setShareCopied] = useState(false);
  usePageMeta({ title: ticker ? `${ticker} – ${t("REPORT")}` : t("REPORT"), description: t("FAIR_VALUE_SECTION") + ". " + t("EXEC_SUM") + "." });
  const isMobile = useIsMobile(700);

  function copyToClipboard(text) {
    navigator.clipboard?.writeText(text).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }
  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: t("REPORT"), url }).then(() => setShareCopied(true)).catch(() => copyToClipboard(url));
    } else {
      copyToClipboard(url);
    }
  };
  const handlePrint = () => window.print();
  const [pdfExporting, setPdfExporting] = useState(false);
  const reportContentRef = React.useRef(null);

  const handleExportPdf = async () => {
    if (!reportContentRef.current || pdfExporting) return;
    setPdfExporting(true);
    try {
      const filename = `${ticker || "report"}-${new Date().toISOString().slice(0, 10)}.pdf`;
      await exportElementAsPdf(reportContentRef.current, filename);
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setPdfExporting(false);
    }
  };

  const [company, setCompany] = useState("");
  const [market, setMarket] = useState("us");
  const [currency, setCurrency] = useState("USD");
  const [price, setPrice] = useState(null);
  const [headerError, setHeaderError] = useState("");

  const [fin, setFin] = useState({ loading: false, error: "", data: null });
  const [val, setVal] = useState({ loading: false, error: "", data: null });
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [profile, setProfile] = useState(null);
  const [translatedProfile, setTranslatedProfile] = useState(null);
  const [prefetchCountdown, setPrefetchCountdown] = useState(PREFETCH_DELAY_SEC);
  const [peers, setPeers] = useState({ loading: false, error: "", list: [] });
  const [peersCountdown, setPeersCountdown] = useState(0);
  const [peersRequested, setPeersRequested] = useState(false);

  const reportDate = useMemo(() => new Date().toLocaleDateString(), []);

  // Company info: immediate (no TwelveData)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setHeaderError("");
        const cj = await getCompany(ticker);
        if (!alive) return;
        setCompany(cj?.name || "");
        setMarket(cj?.market || "us");
        setCurrency(cj?.currency || "USD");
      } catch (e) {
        if (!alive) return;
        setHeaderError(String(e?.message || e));
      }
    })();
    return () => { alive = false; };
  }, [ticker]);

  // Price: LIVE ONLY (no cache)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setHeaderError("");
        const pj = await getLivePrice({ ticker, market, cache: "no-store" });
        if (!alive) return;
        setPrice(Number(pj?.price));
      } catch (e) {
        if (!alive) return;
        setHeaderError(String(e?.message || e));
      }
    })();
    return () => { alive = false; };
  }, [ticker, market]);

  const loadFinancials = useCallback(async () => {
    try {
      setFin({ loading: true, error: "", data: null });
      const j = await getFinancialsCached({ ticker, market });
      setFin({ loading: false, error: "", data: j });
    } catch (e) {
      setFin({ loading: false, error: t("ERR_STATEMENTS"), data: null });
    }
  }, [ticker, market, t]);

  const loadValuation = useCallback(async () => {
    try {
      setVal({ loading: true, error: "", data: null });
      const j = await computeValuation({ ticker, market, cache: "no-store" });
      setVal({ loading: false, error: "", data: j });
    } catch (e) {
      setVal({ loading: false, error: t("ERR_VALUATION"), data: null });
    }
  }, [ticker, market, t]);

  // Prefetch delay: wait PREFETCH_DELAY_SEC then load financials and valuation
  useEffect(() => {
    setPrefetchCountdown(PREFETCH_DELAY_SEC);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, PREFETCH_DELAY_SEC - elapsed);
      setPrefetchCountdown(left);
      if (left <= 0) {
        clearInterval(interval);
        loadFinancials();
        loadValuation();
      }
    }, 200);
    return () => clearInterval(interval);
  }, [ticker, market, loadFinancials, loadValuation]);

  // Logo & profile
  useEffect(() => {
    let alive = true;
    setLogoLoadError(false);
    (async () => {
      try {
        const r = await resolveMarketAndSymbol(ticker, market);
        if (!r.ok || !alive) return;
        const symbol = r.symbol;
        if (market === "sa") {
          const profileRes = await twelveProfile(symbol);
          if (!alive) return;
          setLogoUrl(null);
          setProfile(profileRes && typeof profileRes === "object" ? profileRes : null);
        } else {
          const [logoRes, profileRes] = await Promise.all([twelveLogo(symbol), twelveProfile(symbol)]);
          if (!alive) return;
          const base = logoRes?.logo_base;
          setLogoUrl(base && typeof base === "string" ? base : null);
          setProfile(profileRes && typeof profileRes === "object" ? profileRes : null);
        }
      } catch {
        if (!alive) return;
        setLogoUrl(null);
        setProfile(null);
      }
    })();

    return () => { alive = false; };
  }, [ticker, market]);

  // Translate profile to Arabic when lang is ar
  useEffect(() => {
    let alive = true;
    if (!profile || lang !== "ar") {
      setTranslatedProfile(null);
      return;
    }
    setTranslatedProfile(null);
    (async () => {
      const str = (v) => (v && String(v).trim()) || "";
      const n = str(profile.name), ind = str(profile.industry), sec = str(profile.sector);
      const desc = str(profile.description), co = str(profile.country), ci = str(profile.city), ceo = str(profile.CEO);
      try {
        const [name, industry, sector, description, country, city, ceoTr] = await Promise.all([
          n ? translateToArabic(n) : Promise.resolve(""),
          ind ? translateToArabic(ind) : Promise.resolve(""),
          sec ? translateToArabic(sec) : Promise.resolve(""),
          desc ? translateToArabic(desc) : Promise.resolve(""),
          co ? translateToArabic(co) : Promise.resolve(""),
          ci ? translateToArabic(ci) : Promise.resolve(""),
          ceo ? translateToArabic(ceo) : Promise.resolve(""),
        ]);
        if (!alive) return;
        setTranslatedProfile({
          name: name || profile.name,
          industry: industry || profile.industry,
          sector: sector || profile.sector,
          description: description || profile.description,
          country: country || profile.country,
          city: city || profile.city,
          CEO: ceoTr || profile.CEO,
        });
      } catch {
        if (!alive) return;
        setTranslatedProfile(null);
      }
    })();
    return () => { alive = false; };
  }, [profile, lang]);

  // Industry peers: load only when user clicks button, after 8s countdown
  const loadPeers = useCallback(() => {
    if (!ticker || !market) return;
    let alive = true;
    setPeersRequested(true);
    setPeers((p) => ({ ...p, loading: true, error: "", list: [] }));
    (async () => {
      try {
        const { items } = await getStocks({ market });
        if (!alive) return;
        const tickerNorm = market === "us" ? (ticker || "").toUpperCase() : ticker;
        const currentItem = items.find((i) => (market === "us" ? (i.ticker || "").toUpperCase() === tickerNorm : i.ticker === ticker));
        const industry = currentItem?.industry;
        if (!industry) {
          if (alive) setPeers({ loading: false, error: "", list: [] });
          return;
        }
        const peerItems = items
          .filter((i) => i.industry === industry && (market === "us" ? (i.ticker || "").toUpperCase() !== tickerNorm : i.ticker !== ticker))
          .slice(0, 8);
        const list = [];
        for (const peer of peerItems) {
          if (!alive) break;
          try {
            const v = await computeValuation({ ticker: peer.ticker, market });
            if (!alive) break;
            if (v && Number.isFinite(v.fairEV)) list.push({ ticker: peer.ticker, name: peer.name, fairEV: v.fairEV, price: v?.price ?? null, currency: v.currency });
          } catch {
            // skip failed peer
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        if (alive) setPeers({ loading: false, error: "", list });
      } catch (e) {
        if (alive) setPeers({ loading: false, error: String(e?.message || e), list: [] });
      }
    })();
  }, [ticker, market]);

  useEffect(() => {
    if (peersCountdown <= 0) return;
    const id = setInterval(() => {
      setPeersCountdown((prev) => {
        const next = prev - 1;
        if (next <= 0) setTimeout(() => loadPeers(), 0);
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [peersCountdown, loadPeers]);

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
    const arr = [fair?.fairEV, fair?.fairPS, fair?.fairPE]
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n));
    if (!arr.length) return null;
    return arr.reduce((s, n) => s + n, 0) / arr.length;
  }, [fair]);

  const investmentAdvice = useMemo(() => {
    const p = Number(price);
    const avg = Number(fairAvg);
    const evVal = Number(fair?.fairEV);
    const hasPrice = Number.isFinite(p) && p > 0;
    const avgGtPrice = hasPrice && Number.isFinite(avg) && avg > p;
    const evGtPrice = hasPrice && Number.isFinite(evVal) && evVal > p;
    const revUp = calcTrend(serRevenue).kind === "up";
    const opUp = calcTrend(serOp).kind === "up";
    const netUp = calcTrend(serNet).kind === "up";
    const fcfUp = calcTrend(serFCF).kind === "up";
    const items = [
      { key: "avg", met: avgGtPrice },
      { key: "ev", met: evGtPrice },
      { key: "rev", met: revUp },
      { key: "op", met: opUp },
      { key: "net", met: netUp },
      { key: "fcf", met: fcfUp },
    ];
    const unmatchCount = items.filter((i) => !i.met).length;
    const verdict = unmatchCount === 0 ? "good" : unmatchCount <= 2 ? "hold" : "avoid";
    return { verdict, items };
  }, [price, fairAvg, fair?.fairEV, serRevenue, serOp, serNet, serFCF]);

  const hasZeroData = useMemo(() => {
    if (prefetchCountdown > 0 || fin.loading || val.loading) return false;
    const zeroPrice = price !== null && price !== undefined && Number(price) === 0;
    const zeroFairValue = val?.data && (fairAvg == null || fairAvg === 0);
    const noFinancials = fin?.data && (years.length === 0 || (
      serRevenue.length === 0 && serOp.length === 0 && serNet.length === 0 &&
      serEquity.length === 0 && serFCF.length === 0
    ));
    return zeroPrice || zeroFairValue || noFinancials;
  }, [prefetchCountdown, fin.loading, val.loading, fin?.data, val?.data, price, fairAvg, years.length, serRevenue.length, serOp.length, serNet.length, serEquity.length, serFCF.length]);

  const chartW = isMobile ? 320 : 380;
  const bigChartW = isMobile ? 320 : 480;

  const companyDisplayName = (lang === "ar" && translatedProfile?.name) || profile?.name || company || "";

  return (
    <div style={{ background: "var(--tp-bg, #f5f2eb)", minHeight: "100vh" }} dir={dir} lang={lang}>
      <div
        style={{
          maxWidth: isMobile ? 1100 : 1400,
          margin: "0 auto",
          padding: 16,
          overflowX: "hidden",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
        <div ref={reportContentRef} style={{ flex: 1, minWidth: 0, maxWidth: isMobile ? "100%" : 1100 }}>
        {/* Banner */}
        <div
          className="no-print"
          style={{
            background: "var(--tp-accent, #1a3a2a)",
            color: "#fff",
            borderRadius: 16,
            padding: 14,
            marginBottom: 16,
            boxShadow: "0 1px 10px rgba(0,0,0,0.10)",
            display: "flex",
            alignItems: isMobile ? "stretch" : "center",
            gap: 12,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 200px", maxWidth: isMobile ? "100%" : 420 }}>
            {logoUrl && !logoLoadError ? (
              <img
                src={logoUrl}
                alt=""
                referrerPolicy="no-referrer"
                style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8, background: "#fff", flexShrink: 0 }}
                onError={() => setLogoLoadError(true)}
              />
            ) : null}
            <div style={{ display: "grid", gap: 2, minWidth: 0, overflow: "hidden" }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
                title={(lang === "ar" && translatedProfile?.name) || profile?.name || company || ""}
              >
                {company || (lang === "ar" && translatedProfile?.name) || profile?.name || t("NOT_AVAILABLE")}
                {((lang === "ar" && translatedProfile?.industry) || profile?.industry) ? (
                  <span style={{ fontWeight: 600, opacity: 0.9 }}> – {(lang === "ar" && translatedProfile?.industry) || profile?.industry}</span>
                ) : null}
              </div>
              <div style={{ fontSize: 13, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <b>{t("TICKER")}:</b> {ticker} · <b>{t("REPORT_DATE")}:</b> {reportDate}
              </div>
            </div>
          </div>

          <div
            className="no-print"
            style={{
              marginInlineStart: "auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: isMobile ? "space-between" : "flex-end",
              width: isMobile ? "100%" : "auto",
              minWidth: 0,
            }}
          >
            <div style={{ fontWeight: 800, overflowWrap: "anywhere" }}>
              {t("PRICE")}:{" "}
              {headerError ? (
                <span style={{ color: "#fecaca" }}>{headerError}</span>
              ) : price == null ? (
                t("LOADING")
              ) : (
                `${fmt2(price)} ${currency}`
              )}
            </div>
            <button
              type="button"
              onClick={() => ticker && toggleFavorite(ticker)}
              aria-label={isFavorite(ticker) ? t("REMOVE_FAVORITE") : t("ADD_FAVORITE")}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 999,
                padding: "6px 10px",
                background: "#fff",
                color: isFavorite(ticker) ? "#b45309" : "#6b7280",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              {isFavorite(ticker) ? "★" : "☆"}
            </button>
            <button
              type="button"
              onClick={handleShare}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 999,
                padding: "6px 10px",
                fontWeight: 700,
                background: "#fff",
                color: "#111827",
                cursor: "pointer",
              }}
            >
              {shareCopied ? t("SHARE_COPIED") : t("SHARE_REPORT")}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 999,
                padding: "6px 10px",
                fontWeight: 700,
                background: "#fff",
                color: "#111827",
                cursor: "pointer",
              }}
            >
              {t("PRINT_REPORT")}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={pdfExporting}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 999,
                padding: "6px 10px",
                fontWeight: 700,
                background: "#fff",
                color: "#111827",
                cursor: pdfExporting ? "not-allowed" : "pointer",
                opacity: pdfExporting ? 0.6 : 1,
              }}
            >
              {pdfExporting ? "…" : t("EXPORT_PDF")}
            </button>
            <PillLink to="/" ariaLabel={t("DASHBOARD")}>TruePrice.Cash</PillLink>
            <LangToggle lang={lang} onToggle={toggleLang} t={t} />
          </div>
        </div>

        {hasZeroData ? (
          <div
            style={{
              background: "#fef3c7",
              color: "#92400e",
              padding: "12px 16px",
              borderRadius: 12,
              marginBottom: 16,
              fontWeight: 600,
              border: "1px solid #f59e0b",
            }}
          >
            {t("ZERO_DATA_TRY_AGAIN")}
          </div>
        ) : null}

        {/* 1. Executive Summary */}
        <Card title={t("EXEC_SUM")}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : fin.loading && !fin.data ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr",
                gap: 16,
                alignItems: "start",
                minWidth: 0,
              }}
            >
              <ul style={{ margin: 0, paddingInlineStart: 18, minWidth: 0 }}>
                <li style={{ overflowWrap: "anywhere" }}><b>{t("REV_GROWTH")}:</b> {trendText(serRevenue, t)}</li>
                <li style={{ overflowWrap: "anywhere" }}><b>{t("OP_INCOME")}:</b> {trendText(serOp, t)}</li>
                <li style={{ overflowWrap: "anywhere" }}><b>{t("NET_INCOME")}:</b> {trendText(serNet, t)}</li>
                <li style={{ overflowWrap: "anywhere" }}><b>{t("FCF")}:</b> {trendText(serFCF, t)}</li>
                <li style={{ overflowWrap: "anywhere" }}>
                  <b>{t("STOCK_VALUATION")}:</b> {t("FAIR_ABBR")} ≈ {fmt2(fairAvg)} {currency}
                </li>
              </ul>

              <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", minWidth: 0 }}>
                <CompareBar current={price ?? 0} fair={fairAvg ?? 0} currency={currency} dir={dir} t={t} />
              </div>
            </div>
          )}
        </Card>

        {/* 2. Fair value analysis */}
        <Card title={t("FAIR_VALUE_SECTION")}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : val.loading && !val.data ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : val.error ? (
            <div style={{ color: "#b91c1c" }}>
              {val.error}
              <RetryButton onRetry={loadValuation} t={t} />
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr",
                gap: 16,
                alignItems: "start",
                minWidth: 0,
              }}
            >
              <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                <div style={{ overflowWrap: "anywhere" }}><b>{t("CUR_PRICE")}:</b> {fmt2(price)} {currency}</div>
                <div style={{ overflowWrap: "anywhere" }}><b>{t("FAIR_AVG")}:</b> {fmt2(fairAvg)} {currency}</div>

                <div style={{ marginTop: 10, fontWeight: 900 }}>{t("VAL_METHODS")}</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 6,
                    maxWidth: 520,
                    minWidth: 0,
                  }}
                >
                  <div style={{ overflowWrap: "anywhere" }}>{t("EV_SHARE")}</div>
                  <div style={{ fontWeight: 800, textAlign: "end" }}>{fmt2(fair?.fairEV)} {currency}</div>

                  <div style={{ overflowWrap: "anywhere" }}>{t("PS_BASED")}</div>
                  <div style={{ fontWeight: 800, textAlign: "end" }}>{fmt2(fair?.fairPS)} {currency}</div>

                  <div style={{ overflowWrap: "anywhere" }}>{t("PE_BASED")}</div>
                  <div style={{ fontWeight: 800, textAlign: "end" }}>{fmt2(fair?.fairPE)} {currency}</div>

                  <div style={{ overflowWrap: "anywhere" }}>{t("EQUITY_PER_SHARE")}</div>
                  <div style={{ fontWeight: 800, textAlign: "end" }}>{fmt2(fair?.equityPerShare)} {currency}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", minWidth: 0 }}>
                <CompareBar current={price ?? 0} fair={fairAvg ?? 0} currency={currency} dir={dir} t={t} />
              </div>
            </div>
          )}
        </Card>

        {/* 3. Revenue & Income */}
        <Card title={`${t("REV_INC_TITLE")} (${currency})`}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 12,
                minWidth: 0,
              }}
            >
              <ChartBlock title={t("REVENUE")} series={serRevenue} w={chartW} dir={dir} t={t} />
              <ChartBlock title={t("OP_INCOME")} series={serOp} w={chartW} dir={dir} t={t} />
              <ChartBlock title={t("NET_INCOME")} series={serNet} w={chartW} dir={dir} t={t} />
            </div>
          )}
        </Card>

        {/* 4. Equity & FCF */}
        <Card title={`${t("EQUITY_FCF_TITLE")} (${currency})`}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(360px, 1fr))",
                gap: 12,
                minWidth: 0,
              }}
            >
              <ChartBlock title={t("TOTAL_EQUITY")} series={serEquity} w={bigChartW} dir={dir} t={t} />
              <ChartBlock title={t("FCF")} series={serFCF} w={bigChartW} dir={dir} t={t} />
            </div>
          )}
        </Card>

        {/* 5. Industry peers (EV-based fair value) – button + 8s wait */}
        <Card title={t("INDUSTRY_PEERS_EV")}>
          {peersCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("PEERS_WAIT_8S")} {peersCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("PEERS_WAIT_HINT")}</span>
            </div>
          ) : peers.loading ? (
            <div style={{ color: "#64748b" }}>{t("PEERS_LOADING")}</div>
          ) : peers.error ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: "#b91c1c" }}>{peers.error}</div>
              <button
                type="button"
                onClick={() => { setPeersCountdown(8); }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid #2563eb",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontWeight: 700,
                  cursor: "pointer",
                  alignSelf: "start",
                }}
              >
                {t("PEERS_BUTTON")}
              </button>
            </div>
          ) : !peersRequested && peers.list.length === 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, direction: dir }}>
              <p style={{ margin: 0, color: "#374151", lineHeight: 1.5, flex: "1 1 auto", minWidth: 0 }}>{t("PEERS_PROMPT")}</p>
              <button
                type="button"
                onClick={() => setPeersCountdown(8)}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  borderRadius: 8,
                  border: "1px solid #2563eb",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                  marginInlineStart: "auto",
                }}
              >
                {t("PEERS_BUTTON")}
              </button>
            </div>
          ) : peersRequested && !peers.loading && peers.list.length === 0 && !peers.error ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ color: "#475569" }}>{t("PEERS_NO_PEERS")}</div>
              <button
                type="button"
                onClick={() => setPeersCountdown(8)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid #2563eb",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontWeight: 700,
                  cursor: "pointer",
                  alignSelf: "start",
                }}
              >
                {t("PEERS_BUTTON")}
              </button>
            </div>
          ) : (
            (() => {
              const currentEV = fair?.fairEV;
              const currentName = (lang === "ar" && translatedProfile?.name) || profile?.name || company || ticker;
              const currentPrice = price != null && Number.isFinite(price) ? price : null;
              const rows = [
                ...(currentEV != null && Number.isFinite(currentEV)
                  ? [{ ticker, name: currentName, fairEV: currentEV, price: currentPrice, currency, isCurrent: true }]
                  : []),
                ...peers.list.map((p) => ({ ...p, isCurrent: false })),
              ].sort((a, b) => (b.fairEV || 0) - (a.fairEV || 0));
              const hasZeroValue = rows.some((r) => r.fairEV === 0 || !Number.isFinite(r.fairEV));
              if (rows.length === 0) return <div style={{ color: "#475569" }}>{t("PEERS_NO_PEERS")}</div>;
              return (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={{ textAlign: "start", padding: 10, borderBottom: "1px solid #e5e7eb" }}>{t("TICKER")}</th>
                          <th style={{ textAlign: "start", padding: 10, borderBottom: "1px solid #e5e7eb" }}>{t("COMPANIES")}</th>
                          <th style={{ textAlign: "end", padding: 10, borderBottom: "1px solid #e5e7eb" }}>{t("PRICE")}</th>
                          <th style={{ textAlign: "end", padding: 10, borderBottom: "1px solid #e5e7eb" }}>{t("EV_SHARE")}</th>
                          <th style={{ textAlign: "end", padding: 10, borderBottom: "1px solid #e5e7eb" }}>{t("PEERS_DIFF_PCT")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const rowPrice = row.price != null && Number.isFinite(row.price) ? row.price : null;
                          const diffPct =
                            rowPrice != null && rowPrice > 0 && row.fairEV != null && Number.isFinite(row.fairEV)
                              ? `${(((row.fairEV - rowPrice) / rowPrice) * 100).toFixed(1)}%`
                              : "—";
                          return (
                            <tr
                              key={row.ticker + (row.isCurrent ? "-current" : "")}
                              style={{
                                background: row.isCurrent ? "#eff6ff" : undefined,
                                borderBottom: "1px solid #f1f5f9",
                              }}
                            >
                              <td style={{ padding: 10, fontWeight: row.isCurrent ? 700 : 400 }}>
                                {row.isCurrent ? t("THIS_STOCK") : (
                                  <Link to={`/stock/${row.ticker}`} style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
                                    {row.ticker}
                                  </Link>
                                )}
                              </td>
                              <td style={{ padding: 10, overflowWrap: "anywhere" }}>{row.name}</td>
                              <td style={{ textAlign: "end", padding: 10 }}>{rowPrice != null ? fmt2(rowPrice) + " " + row.currency : "—"}</td>
                              <td style={{ textAlign: "end", padding: 10, fontWeight: 600 }}>{fmt2(row.fairEV)} {row.currency}</td>
                              <td style={{ textAlign: "end", padding: 10, color: row.isCurrent ? "#64748b" : "#0f172a" }}>{diffPct}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {hasZeroValue ? (
                    <div
                      style={{
                        background: "#fef3c7",
                        color: "#92400e",
                        padding: "10px 14px",
                        borderRadius: 10,
                        fontWeight: 600,
                        border: "1px solid #f59e0b",
                      }}
                    >
                      {t("ZERO_PEER_TRY_AGAIN")}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", direction: dir }}>
                    <button
                      type="button"
                      onClick={() => setPeersCountdown(8)}
                      style={{
                        padding: "6px 12px",
                        fontSize: 13,
                        borderRadius: 8,
                        border: "1px solid #2563eb",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontWeight: 600,
                        cursor: "pointer",
                        marginInlineStart: "auto",
                      }}
                    >
                      {t("PEERS_BUTTON")}
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </Card>

        {/* 6. Investment summary */}
        <Card title={t("INVESTMENT_SUMMARY")}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : (fin.loading && !fin.data) || (val.loading && !val.data) ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#374151" }}>
                {t("INVESTMENT_CONDITIONS_INTRO")}
              </div>
              <ul style={{ margin: 0, paddingInlineStart: 20, display: "grid", gap: 6, color: "#475569", fontSize: 14 }}>
                {investmentAdvice.items.map((item) => (
                  <li key={item.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: item.met ? "#15803d" : "#b91c1c", fontWeight: 700 }}>
                      {item.met ? "✓" : "✗"}
                    </span>
                    <span>
                      {t(`INVESTMENT_CONDITION_${item.key.toUpperCase()}`)}
                    </span>
                  </li>
                ))}
              </ul>
              {(investmentAdvice.verdict === "hold" || investmentAdvice.verdict === "avoid") && (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#374151" }}>
                    {t("INVESTMENT_WAIT_UNTIL")}
                  </div>
                  <ul style={{ margin: 0, paddingInlineStart: 20, display: "grid", gap: 4, color: "#64748b", fontSize: 12 }}>
                    {investmentAdvice.items
                      .filter((i) => !i.met)
                      .map((item) => (
                        <li key={item.key}>
                          • {t(`INVESTMENT_CONDITION_${item.key.toUpperCase()}`)}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  color:
                    investmentAdvice.verdict === "good"
                      ? "#15803d"
                      : investmentAdvice.verdict === "hold"
                        ? "#1d4ed8"
                        : "#b91c1c",
                }}
              >
                {investmentAdvice.verdict === "good"
                  ? t("INVESTMENT_GOOD")
                  : investmentAdvice.verdict === "hold"
                    ? t("INVESTMENT_HOLD")
                    : t("INVESTMENT_AVOID")}
              </div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: "#ca8a04",
                }}
              >
                {t("INVESTMENT_DISCLAIMER")}
              </div>
            </div>
          )}
        </Card>

        {/* 7. Company profile */}
        <Card title={t("COMPANY_PROFILE")}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : !profile ? (
            <div style={{ color: "#475569" }}>{t("NO_DATA")}</div>
          ) : (
            <div style={{ display: "grid", gap: 12, minWidth: 0, width: "100%" }}>
              {(() => {
                const P = lang === "ar" && translatedProfile ? translatedProfile : profile;
                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)", gap: "6px 16px", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("TICKER")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{profile.symbol ?? ticker}</span>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("INDUSTRY")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{P.industry || t("NOT_AVAILABLE")}</span>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("SECTOR")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{P.sector || t("NOT_AVAILABLE")}</span>
                    </div>
                    {(P.description || profile.description) ? (
                      <>
                        <div style={{ fontWeight: 700, color: "#374151" }}>{t("DESCRIPTION")}</div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            lineHeight: 1.6,
                            color: "#334155",
                            width: "100%",
                            maxWidth: "100%",
                            boxSizing: "border-box",
                            textAlign: "justify",
                            overflowWrap: "break-word",
                            wordBreak: "break-word",
                          }}
                        >
                          {P.description || profile.description}
                        </p>
                      </>
                    ) : null}
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)", gap: "6px 16px", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("CITY")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{P.city || t("NOT_AVAILABLE")}</span>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("COUNTRY")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{P.country || t("NOT_AVAILABLE")}</span>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("CEO")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{P.CEO || t("NOT_AVAILABLE")}</span>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("WEBSITE")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>
                        {profile.website ? (
                          <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "none" }}>
                            {profile.website}
                          </a>
                        ) : (
                          t("NOT_AVAILABLE")
                        )}
                      </span>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{t("CONTACT")}</span>
                      <span style={{ overflowWrap: "anywhere" }}>{profile.phone || t("NOT_AVAILABLE")}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </Card>

        {/* Appendix */}
        <Card title={t("APPENDIX")}>
          {prefetchCountdown > 0 ? (
            <div style={{ color: "#64748b", display: "grid", gap: 4 }}>
              <span>{t("WAITING_BEFORE_FETCH")} {prefetchCountdown}s</span>
              <span style={{ fontSize: 13 }}>{t("WAITING_PREFETCH_HINT")}</span>
            </div>
          ) : fin.loading && !fin.data ? (
            <div style={{ color: "#64748b" }}>Loading…</div>
          ) : fin.error ? (
            <div style={{ color: "#b91c1c" }}>
              {fin.error}
              <RetryButton onRetry={loadFinancials} t={t} />
            </div>
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
                      <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{y.year}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{fmtBill(y.revenue)}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{fmtBill(y.operatingIncome)}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{fmtBill(y.netIncome)}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{fmtBill(y.totalEquity)}</td>
                      <td style={{ textAlign: "end", padding: 8, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{fmtBill(y.freeCashFlow)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </div>

        {market === "us" ? (
          <StockNewsSidebar ticker={ticker} companyName={companyDisplayName} market={market} t={t} dir={dir} isMobile={isMobile} />
        ) : null}
      </div>

      <footer className="no-print" style={{ marginTop: 24, padding: "14px 4px", textAlign: "center", color: "var(--tp-muted, #64748b)", fontSize: 12 }}>
        © TruePrice.Cash
      </footer>
    </div>
  );
}
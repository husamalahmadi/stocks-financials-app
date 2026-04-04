/**
 * Fetches stock news from RSS feeds.
 * Primary: rss2json.com API (browser CORS–friendly) for Google News and Yahoo Finance.
 * Fallback: third-party CORS proxies + optional same-origin /api/proxy-rss (Vercel).
 */

const RSS2JSON_URL = "https://api.rss2json.com/v1/api.json";

function getProxyUrls(targetUrl) {
  const encoded = encodeURIComponent(targetUrl);
  return [
    () => `https://api.cors.syrins.tech/?url=${encoded}`,
    () => `https://api.allorigins.win/get?url=${encoded}`,
    () => `https://api.allorigins.win/raw?url=${encoded}`,
    () => `https://corsproxy.io/?url=${encoded}`,
    () => `${typeof window !== "undefined" ? window.location.origin : ""}/api/proxy-rss?url=${encoded}`,
  ];
}

function buildGoogleNewsRssUrl(ticker, companyName = "", market = "us") {
  const searchTerm = market === "sa" && companyName?.trim()
    ? companyName.trim()
    : `${ticker.trim()} stock`;
  const query = encodeURIComponent(searchTerm);
  const hl = market === "sa" ? "ar" : "en-US";
  const gl = market === "sa" ? "SA" : "US";
  const ceid = market === "sa" ? "SA:ar" : "US:en";
  return `https://news.google.com/rss/search?q=${query}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

function buildYahooHeadlineRssUrl(ticker, market = "us") {
  const sym = String(ticker ?? "").trim().toUpperCase();
  if (!sym) return "";
  const yahooSymbol = market === "sa" ? `${sym}.SR` : sym;
  const region = market === "sa" ? "SA" : "US";
  return `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(yahooSymbol)}&region=${region}&lang=en-US`;
}

/**
 * @param {string} rssUrl
 * @returns {Promise<{ title: string, link: string, date: Date | null, source: string }[]>}
 */
async function fetchViaRss2Json(rssUrl) {
  if (!rssUrl || typeof rssUrl !== "string") return [];
  const apiKey =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_RSS2JSON_API_KEY
      ? String(import.meta.env.VITE_RSS2JSON_API_KEY).trim()
      : "";
  let api = `${RSS2JSON_URL}?rss_url=${encodeURIComponent(rssUrl)}`;
  if (apiKey) api += `&api_key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(api, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== "ok" || !Array.isArray(data.items)) return [];

    const articles = [];
    for (const item of data.items) {
      const title = String(item.title ?? "").trim();
      const link = String(item.link ?? "").trim();
      if (!title || !link) continue;
      let date = null;
      if (item.pubDate) {
        const d = new Date(item.pubDate);
        if (!Number.isNaN(d.getTime())) date = d;
      }
      const source = String(item.author ?? item.source ?? "").trim();
      articles.push({ title, link, date, source });
    }
    articles.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
    return articles;
  } catch {
    return [];
  }
}

function parseRssXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const items = doc.getElementsByTagName("item");
  const articles = [];

  for (const item of items) {
    const titleEl = item.querySelector("title");
    const linkEl = item.querySelector("link");
    const pubDateEl = item.querySelector("pubDate");
    const sourceEl = item.querySelector("source");

    const title = titleEl?.textContent?.trim() || "";
    const link = linkEl?.textContent?.trim() || "";
    const pubDateStr = pubDateEl?.textContent?.trim() || "";
    const source = sourceEl?.textContent?.trim() || "";

    let date = null;
    if (pubDateStr) {
      const d = new Date(pubDateStr);
      if (!Number.isNaN(d.getTime())) date = d;
    }

    if (title && link) {
      articles.push({ title, link, date, source });
    }
  }

  if (articles.length === 0 && xmlText.includes("<item>")) {
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const titleRegex = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([^<]*)<\/title>/i;
    const linkRegex = /<link>([^<]*)<\/link>/i;
    let match;
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const block = match[1];
      const titleMatch = block.match(titleRegex);
      const linkMatch = block.match(linkRegex);
      const t = titleMatch ? (titleMatch[1] || titleMatch[2] || "").trim() : "";
      const l = linkMatch ? linkMatch[1].trim() : "";
      if (t && l && !t.includes("Google News")) {
        articles.push({ title: t, link: l, date: null, source: "" });
      }
    }
  }

  articles.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  return articles;
}

async function fetchViaProxy(url) {
  const proxies = getProxyUrls(url);
  let lastError = null;
  for (const getProxyUrl of proxies) {
    try {
      const proxyUrl = getProxyUrl();
      if (!proxyUrl.startsWith("http")) continue;
      const res = await fetch(proxyUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let text = await res.text();
      if (proxyUrl.includes("allorigins.win/get")) {
        try {
          const json = JSON.parse(text);
          text = json?.contents ?? "";
        } catch {
          /* use raw text */
        }
      }
      if (text && text.trim().length > 0) return text;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("Failed to fetch news");
}

/**
 * Fetches news articles for a stock.
 * @param {{ ticker: string, companyName?: string, market?: string }} options
 * @returns {Promise<{ title: string, link: string, date: Date | null, source: string }[]>}
 */
export async function fetchStockNews({ ticker, companyName = "", market = "us" }) {
  if (!ticker || typeof ticker !== "string") return [];

  const m = market === "sa" ? "sa" : "us";
  const googleRss = buildGoogleNewsRssUrl(ticker.trim(), String(companyName).trim(), m);

  let articles = await fetchViaRss2Json(googleRss);
  if (articles.length > 0) return articles;

  const yahooRss = buildYahooHeadlineRssUrl(ticker, m);
  if (yahooRss) {
    articles = await fetchViaRss2Json(yahooRss);
    if (articles.length > 0) return articles;
  }

  try {
    const text = await fetchViaProxy(googleRss);
    return parseRssXml(text);
  } catch (e) {
    throw e;
  }
}

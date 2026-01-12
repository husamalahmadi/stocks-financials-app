// FILE: client/src/apiBase.js
// WHY: avoid empty base URL in dev; guess backend URL if env var missing.
const guessDevPort = () => {
  // Common backend ports; first one that responds will work (but we just build a URL here).
  return 3000;
};

export function getApiBase() {
  // 1) Respect explicit env var
  const envBase = import.meta.env.VITE_API_BASE?.trim();
  if (envBase) return envBase.replace(/\/+$/, "");

  // 2) Dev: running on Vite (localhost:5173 or 127.0.0.1), assume server on :3000
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const port = guessDevPort();
    return `${protocol}//${hostname}:${port}`;
  }

  // 3) Prod: same-origin (frontend served by backend)
  if (typeof window !== "undefined") {
    return `${window.location.origin}`;
  }

  // 4) Safe fallback
  return "";
}

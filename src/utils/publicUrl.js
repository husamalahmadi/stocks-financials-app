// FILE: src/utils/publicUrl.js
/**
 * Builds a URL to a file in Vite "public/" that works on:
 * - local dev (BASE_URL = "/")
 * - GitHub Pages repo sites (BASE_URL = "/repo-name/")
 */
export function publicUrl(path) {
  const base = String(import.meta.env.BASE_URL || "/");
  const baseNorm = base.endsWith("/") ? base : `${base}/`;
  const clean = String(path || "").replace(/^\/+/, "");
  return `${baseNorm}${clean}`;
}

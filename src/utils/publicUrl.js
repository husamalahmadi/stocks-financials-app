// FILE: src/utils/publicUrl.js
export function publicUrl(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  return new URL(clean, import.meta.env.BASE_URL).toString();
}

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/stocks-financials-app/docs",
  plugins: [react()],
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
});

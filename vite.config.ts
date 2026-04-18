import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api/close-proxy": {
        target: "https://api.close.com",
        changeOrigin: true,
        rewrite: (p) => {
          const url = new URL(p, "http://localhost");
          const endpoint = url.searchParams.get("endpoint") || "";
          const params = new URLSearchParams();
          for (const [k, v] of url.searchParams.entries()) {
            if (k !== "endpoint") params.set(k, v);
          }
          return `/api/v1/${endpoint}${params.toString() ? "?" + params.toString() : ""}`;
        },
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            const key = process.env.CLOSE_API_KEY;
            if (key) {
              proxyReq.setHeader("Authorization", "Basic " + Buffer.from(key + ":").toString("base64"));
            }
          });
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

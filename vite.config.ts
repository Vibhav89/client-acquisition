import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.CLIENT_RADAR_API_TARGET || "http://localhost:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (_err, _req, res) => {
            if ("writeHead" in res && !res.headersSent) {
              res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({
                error: `Backend API server unavailable at ${apiTarget}. Run "npm run server" or "npm start".`,
              }));
            }
          });
        },
      },
    },
  },
});


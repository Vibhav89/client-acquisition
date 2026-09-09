import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.CLIENT_RADAR_API_TARGET ?? "http://localhost:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});

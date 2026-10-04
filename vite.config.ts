import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { developmentOrigins, developmentPorts } from "./shared/development";
export default defineConfig({
  plugins: [react()],
  server: {
    port: developmentPorts.frontend,
    strictPort: true,
    proxy: { "/api": developmentOrigins.backend },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { framework: ["react", "react-dom", "react-router-dom"] },
      },
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});

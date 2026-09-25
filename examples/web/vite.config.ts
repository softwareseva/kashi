import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// /v1 is proxied to `wrangler dev` so cookies are same-origin in development.
// PORT and API_URL let the example run next to other local projects.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
    proxy: { "/v1": process.env.API_URL ?? "http://localhost:8787" },
  },
});

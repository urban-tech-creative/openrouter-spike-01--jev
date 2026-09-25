import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// The Cloudflare plugin runs worker/index.ts inside the real Workers runtime
// during `npm run dev`, so /api/decide works locally exactly as when deployed.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
});

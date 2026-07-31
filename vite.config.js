import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // SPA fallback — lets direct URL access to /p/:code work in dev and
  // preview by serving index.html for any path the router handles.
  appType: 'spa',
});
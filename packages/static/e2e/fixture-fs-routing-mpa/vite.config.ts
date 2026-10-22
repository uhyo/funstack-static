import funstackStatic from "@funstack/static";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    funstackStatic({
      ssr: true,
      fsRoutes: {
        dir: "./src/pages",
        root: "./src/root.tsx",
        adapter: "@funstack/static/fs-routes/next-adapter",
        // Multi-page application: links load the destination's own HTML
        // instead of soft client-side navigation.
        mode: "mpa",
      },
    }),
    react(),
  ],
});

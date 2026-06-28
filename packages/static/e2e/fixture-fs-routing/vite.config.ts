import funstackStatic from "@funstack/static";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    funstackStatic({
      // Intentionally `ssr: false` to guard the dev-server fix for issue #124:
      // file-system routing must render in `vite dev` without SSR.
      ssr: false,
      fsRoutes: {
        dir: "./src/pages",
        root: "./src/root.tsx",
        adapter: "@funstack/static/fs-routes/next-adapter",
      },
    }),
    react(),
  ],
});

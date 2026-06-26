import funstackStatic from "@funstack/static";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    funstackStatic({
      // Intentionally left at the default `ssr: false` to exercise file-system
      // routing without SSR in both dev and build (see issue #124).
      fsRoutes: {
        dir: "./src/pages",
        root: "./src/root.tsx",
      },
    }),
    react(),
  ],
});

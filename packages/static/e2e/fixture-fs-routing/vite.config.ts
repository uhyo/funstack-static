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
      },
    }),
    react(),
  ],
});

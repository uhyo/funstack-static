import funstackStatic from "@funstack/static";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    funstackStatic({
      // `ssr` is deliberately left unset: in "mpa" mode every page is
      // rendered to complete HTML regardless.
      fsRoutes: {
        dir: "./src/pages",
        root: "./src/root.tsx",
        adapter: "@funstack/static/fs-routes/next-adapter",
        mode: "mpa",
      },
    }),
    react(),
  ],
});

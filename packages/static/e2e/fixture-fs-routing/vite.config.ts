import funstackStatic from "@funstack/static";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    funstackStatic({
      // Required for file-system routing to render in the dev server.
      ssr: true,
      fsRoutes: {
        dir: "./src/pages",
        root: "./src/root.tsx",
        adapter: "./src/adapter.ts",
      },
    }),
    react(),
  ],
});

import funstackStatic from "@funstack/static";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    funstackStatic({
      // File-system routing is set up in the entries module using
      // `@funstack/static/fs-routes`.
      entries: "./src/entries.tsx",
    }),
    react(),
  ],
});

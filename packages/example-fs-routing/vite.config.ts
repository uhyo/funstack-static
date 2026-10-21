import funstackStatic from "@funstack/static";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    funstackStatic({
      // Built-in file-system routing. Pages under `src/pages` are mapped to
      // routes via the Next.js-like adapter and rendered with FUNSTACK Router.
      fsRoutes: {
        dir: "./src/pages",
        root: "./src/root.tsx",
        adapter: "@funstack/static/fs-routes/next-adapter",
        // Pages load the client runtime and navigate in the browser (the
        // default, "spa"). Set `mode: "mpa"` for a site that ships no
        // JavaScript at all: complete HTML pages linked by plain navigations.
      },
    }),
    react(),
  ],
});

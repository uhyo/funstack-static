import funstackStatic from "@funstack/static";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    funstackStatic({
      // SSR is recommended for SEO and faster initial load (pages are server
      // components rendered through FUNSTACK Router), but no longer required for
      // file-system routing to render in the dev server (see issue #124).
      ssr: true,
      // Built-in file-system routing. Pages under `src/pages` are mapped to
      // routes via the Next.js-like adapter and rendered with FUNSTACK Router.
      fsRoutes: {
        dir: "./src/pages",
        root: "./src/root.tsx",
        adapter: "@funstack/static/fs-routes/next-adapter",
      },
    }),
    react(),
  ],
});

import funstackStatic from "@funstack/static";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    funstackStatic({
      // SSR is optional for file-system routing (the dev server always
      // server-renders pages either way), but is recommended in general for
      // SEO and faster initial load.
      ssr: true,
      // Built-in file-system routing. Pages under `src/pages` are mapped to
      // routes via the Next.js-like adapter and rendered with FUNSTACK Router.
      fsRoutes: {
        dir: "./src/pages",
        root: "./src/root.tsx",
      },
    }),
    react(),
  ],
});

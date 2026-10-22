import funstackStatic from "@funstack/static";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    funstackStatic({
      ssr: true,
      // Built-in file-system routing in MPA mode: pages under `src/pages` are
      // mapped to routes via the Next.js-like adapter and rendered with
      // FUNSTACK Router's `<RouteDisplay>`, which never intercepts
      // navigations. Every link loads the destination's own HTML, like a
      // classic multi-page site. Compare with `example-fs-routing`, which
      // uses the default "spa" mode with soft client-side navigation.
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

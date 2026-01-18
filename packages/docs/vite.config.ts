import funstackStatic from "@funstack/static";
import mdx from "@mdx-js/rollup";
import rehypeShiki from "@shikijs/rehype";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    funstackStatic({
      root: "./src/root.tsx",
      app: "./src/App.tsx",
    }),
    {
      enforce: "pre",
      ...mdx({
        rehypePlugins: [
          [
            rehypeShiki,
            {
              themes: {
                light: "github-light",
                dark: "github-dark",
              },
            },
          ],
        ],
      }),
    },
    react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
  ],
  base: "/funstack-static/",
});

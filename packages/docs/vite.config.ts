import funstackStatic from "@funstack/static";
import mdx from "@mdx-js/rollup";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import react from "@vitejs/plugin-react";
import rehypeSlug from "rehype-slug";
import { defineConfig, type UserConfig } from "vite";
import { getHighlighter, shikiThemes } from "./src/lib/shiki";

export default defineConfig(async () => {
  const highlighter = await getHighlighter();

  const config: UserConfig = {
    plugins: [
      funstackStatic({
        root: "./src/root.tsx",
        app: "./src/App.tsx",
      }),
      {
        // to make .mdx loading lazy
        name: "vite-plugin-mdx-lazy",
        load(id) {
          if (id.endsWith(".mdx")) {
            return `
import { lazy } from "react";

export default lazy(() => import("${id}?lazy"));
`;
          }
          return undefined;
        },
      },
      {
        enforce: "pre",
        ...mdx({
          rehypePlugins: [
            rehypeSlug,
            [
              rehypeShikiFromHighlighter,
              highlighter,
              {
                themes: shikiThemes,
              },
            ],
          ],
        }),
      },
      react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
    ],
    base: "/",
  };
  return config;
});

import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { BuildEntryFunction } from "@funstack/static/server";
import type { RouteDefinition } from "@funstack/router/server";
import { routes } from "./App";

const siteUrl = "https://static.funstack.work";

function collectPaths(routes: RouteDefinition[]): string[] {
  const paths: string[] = [];
  for (const route of routes) {
    if (route.children) {
      paths.push(...collectPaths(route.children));
    } else if (route.path !== undefined && route.path !== "*") {
      paths.push(route.path);
    }
  }
  return paths;
}

function generateSitemap(paths: string[]): string {
  const urls = paths
    .map((p) => {
      const loc = p === "/" ? siteUrl + "/" : `${siteUrl}${p}`;
      return `  <url>\n    <loc>${loc}</loc>\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export default (async ({ build, outDir }) => {
  const paths = collectPaths(routes);

  await Promise.all([
    build(),
    writeFile(path.join(outDir, "sitemap.xml"), generateSitemap(paths)),
  ]);
}) satisfies BuildEntryFunction;

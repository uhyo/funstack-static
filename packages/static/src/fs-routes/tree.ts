import type { FsRouteModule, FsRouteTreeNode } from "./types";

/**
 * A single page to statically generate.
 */
export interface StaticPage {
  /** Concrete URL path, e.g. `"/"`, `"/about"`, `"/blog/hello"`. */
  urlPath: string;
  /** Resolved dynamic params for this page (empty for static routes). */
  params: Record<string, string>;
}

/**
 * Splits a FUNSTACK Router path (e.g. `"/blog/:slug"`) into its non-empty
 * segments. A pathless or `"/"` path yields no segments.
 */
function splitRoutePath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

/**
 * Joins URL segments into a normalized absolute URL path.
 */
function segmentsToUrl(segments: string[]): string {
  const joined = segments
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/^\//, "")
    .replace(/\/$/, "");
  return joined === "" ? "/" : `/${joined}`;
}

/**
 * Extracts the param name from a dynamic segment.
 * `":slug"` → `"slug"`, `":slug*"` (catch-all) → `"slug"`.
 */
function paramName(segment: string): string {
  return segment.slice(1).replace(/\*$/, "");
}

/**
 * Whether a router segment is dynamic (`:param` or catch-all `:param*`).
 */
function isDynamicSegment(segment: string): boolean {
  return segment.startsWith(":");
}

async function addPagesForLeaf(
  segments: string[],
  module: FsRouteModule,
  pages: StaticPage[],
  onWarn?: (message: string) => void,
): Promise<void> {
  const dynamicSegments = segments.filter(isDynamicSegment);

  if (dynamicSegments.length === 0) {
    pages.push({ urlPath: segmentsToUrl(segments), params: {} });
    return;
  }

  const generate = module.generateStaticParams;
  if (typeof generate !== "function") {
    onWarn?.(
      `Dynamic route "${segmentsToUrl(segments)}" has no generateStaticParams() export; skipping static generation. ` +
        `It will still work on the client via the SPA fallback.`,
    );
    return;
  }

  const paramSets = await generate();
  for (const params of paramSets) {
    const concreteSegments = segments.map((segment) => {
      if (!isDynamicSegment(segment)) return segment;
      const name = paramName(segment);
      const value = params[name];
      if (value === undefined) {
        throw new Error(
          `generateStaticParams() for "${segmentsToUrl(segments)}" is missing a value for param "${name}".`,
        );
      }
      return value;
    });
    pages.push({ urlPath: segmentsToUrl(concreteSegments), params });
  }
}

async function walk(
  nodes: FsRouteTreeNode[],
  prefixSegments: string[],
  pages: StaticPage[],
  onWarn?: (message: string) => void,
): Promise<void> {
  for (const node of nodes) {
    const ownSegments =
      node.path !== undefined ? splitRoutePath(node.path) : [];
    const segments = [...prefixSegments, ...ownSegments];
    if (node.page) {
      await addPagesForLeaf(segments, node.module, pages, onWarn);
    }
    if (node.children) {
      await walk(node.children, segments, pages, onWarn);
    }
  }
}

/**
 * Walks a route tree and enumerates every page to statically generate.
 *
 * Static routes are emitted directly. Dynamic routes (with `:param` or
 * catch-all segments) are expanded using each page module's
 * `generateStaticParams()`; if absent, the route is skipped and `onWarn` is
 * invoked.
 */
export async function collectStaticPaths(
  tree: FsRouteTreeNode[],
  onWarn?: (message: string) => void,
): Promise<StaticPage[]> {
  const pages: StaticPage[] = [];
  await walk(tree, [], pages, onWarn);
  return pages;
}

/**
 * Maps a URL path to the output HTML file path relative to the build output.
 *
 * `"/"` → `"index.html"`, `"/about"` → `"about.html"`,
 * `"/blog/hello"` → `"blog/hello.html"`.
 */
export function urlPathToFilePath(urlPath: string): string {
  if (urlPath === "/" || urlPath === "") {
    return "index.html";
  }
  const stripped = urlPath.replace(/^\//, "").replace(/\/$/, "");
  return `${stripped}.html`;
}

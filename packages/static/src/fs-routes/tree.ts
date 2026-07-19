import type { FsRouteFile, FsRouteModule, FsRouteTreeNode } from "./types";

/**
 * Options for {@link modulesToRouteFiles}.
 */
export interface ModulesToRouteFilesOptions {
  /** Called with a human-readable message when something looks wrong. */
  onWarn?: (message: string) => void;
  /**
   * The routes directory that glob keys are relative to, e.g. `"./pages"` or
   * `"/src/pages"`. When provided, it is stripped from every key
   * deterministically. When omitted (or when it does not prefix every key),
   * the longest common directory prefix across all keys is stripped instead —
   * a heuristic that misdetects the root when every page happens to live
   * under one shared subdirectory.
   */
  base?: string;
}

/**
 * Returns the candidate `"<dir>/"` prefixes to strip for a user-provided
 * base. A base written without a leading `"./"` also matches the `"./"`-style
 * keys Vite produces for relative glob patterns.
 */
function basePrefixes(base: string): string[] {
  const prefix = `${base.replace(/\/+$/, "")}/`;
  if (!prefix.startsWith("/") && !prefix.startsWith("./")) {
    return [prefix, `./${prefix}`];
  }
  return [prefix];
}

/**
 * Converts the result of an eager `import.meta.glob` into route files.
 *
 * Each file's path is made relative to the routes directory: the `base`
 * option is stripped when provided, otherwise the longest common leading
 * directory prefix across all keys is stripped as a fallback heuristic.
 */
export function modulesToRouteFiles(
  modules: Record<string, FsRouteModule>,
  options: ModulesToRouteFilesOptions = {},
): FsRouteFile[] {
  const { onWarn, base } = options;
  const keys = Object.keys(modules);
  if (keys.length === 0) {
    onWarn?.(
      "createFsRoutesEntries received no modules. Did your import.meta.glob pattern match any files?",
    );
    return [];
  }

  if (base !== undefined) {
    const prefix = basePrefixes(base).find((candidate) =>
      keys.every((key) => key.startsWith(candidate)),
    );
    if (prefix !== undefined) {
      return keys.map((key) => ({
        filePath: key.slice(prefix.length),
        module: modules[key]!,
      }));
    }
    onWarn?.(
      `base "${base}" is not a prefix of every module key; ` +
        `falling back to common-prefix detection. ` +
        `Pass the same directory your import.meta.glob pattern starts with.`,
    );
  }

  // Directory segments of each key (excluding the file name).
  const dirSegments = keys.map((key) => key.split("/").slice(0, -1));
  let commonLength = Math.min(
    ...dirSegments.map((segments) => segments.length),
  );
  for (let i = 0; i < commonLength; i++) {
    const segment = dirSegments[0]![i];
    if (!dirSegments.every((segments) => segments[i] === segment)) {
      commonLength = i;
      break;
    }
  }

  return keys.map((key) => ({
    filePath: key.split("/").slice(commonLength).join("/"),
    module: modules[key]!,
  }));
}

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
): Promise<void> {
  const dynamicSegments = segments.filter(isDynamicSegment);

  if (dynamicSegments.length === 0) {
    pages.push({ urlPath: segmentsToUrl(segments), params: {} });
    return;
  }

  const generate = module.generateStaticParams;
  if (typeof generate !== "function") {
    throw new Error(
      `Dynamic route "${segmentsToUrl(segments)}" has no generateStaticParams() export. ` +
        `Every page of a static site must be enumerated at build time; ` +
        `export generateStaticParams() from the page module to list the params to pre-render.`,
    );
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
): Promise<void> {
  for (const node of nodes) {
    const ownSegments =
      node.path !== undefined ? splitRoutePath(node.path) : [];
    const segments = [...prefixSegments, ...ownSegments];
    if (node.page) {
      await addPagesForLeaf(segments, node.module, pages);
    }
    if (node.children) {
      await walk(node.children, segments, pages);
    }
  }
}

/**
 * Walks a route tree and enumerates every page to statically generate.
 *
 * Static routes are emitted directly. Dynamic routes (with `:param` or
 * catch-all segments) are expanded using each page module's
 * `generateStaticParams()`; a dynamic route without that export fails the
 * build, since a static site cannot serve pages that were not enumerated at
 * build time.
 */
export async function collectStaticPaths(
  tree: FsRouteTreeNode[],
): Promise<StaticPage[]> {
  const pages: StaticPage[] = [];
  await walk(tree, [], pages);
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

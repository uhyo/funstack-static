import { isClientReference } from "../util/clientReference";
import type { FsRouteFile, FsRouteModule, FsRouteTreeNode } from "./types";

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
 * The routes directory `base` is stripped from every key so that each file's
 * path is relative to the routes directory. Throws if `base` does not prefix
 * every key, since route paths cannot be derived from a wrong base.
 */
export function modulesToRouteFiles(
  modules: Record<string, FsRouteModule>,
  base: string,
  onWarn?: (message: string) => void,
): FsRouteFile[] {
  const keys = Object.keys(modules);
  if (keys.length === 0) {
    onWarn?.(
      "createFsRoutesEntries received no modules. Did your import.meta.glob pattern match any files?",
    );
    return [];
  }

  const prefix = basePrefixes(base).find((candidate) =>
    keys.every((key) => key.startsWith(candidate)),
  );
  if (prefix === undefined) {
    throw new Error(
      `base "${base}" is not a prefix of every globbed module key (e.g. "${keys[0]}"). ` +
        `Pass the directory your import.meta.glob pattern starts with.`,
    );
  }

  return keys.map((key) => ({
    filePath: key.slice(prefix.length),
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
  /**
   * The route tree nodes this page renders through, root-first, ending with
   * the page node itself. Contains the same node objects as the tree passed
   * to {@link collectStaticPaths}.
   */
  chain: FsRouteTreeNode[];
}

/**
 * Splits a FUNSTACK Router path (e.g. `"/blog/:slug"`) into its non-empty
 * segments. A pathless or `"/"` path yields no segments.
 */
export function splitRoutePath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

/**
 * Joins URL segments into an absolute URL path. Segments are non-empty and
 * carry no leading or trailing slashes ({@link splitRoutePath} filters
 * empties, and substituted param values are validated), so joining yields a
 * normalized path; only catch-all values contribute interior slashes.
 */
function segmentsToUrl(segments: string[]): string {
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

/**
 * Extracts the param name from a dynamic segment.
 * `":slug"` → `"slug"`, `":slug*"` (catch-all) → `"slug"`.
 */
export function paramName(segment: string): string {
  return segment.slice(1).replace(/\*$/, "");
}

/**
 * Whether a router segment is dynamic (`:param` or catch-all `:param*`).
 */
export function isDynamicSegment(segment: string): boolean {
  return segment.startsWith(":");
}

/**
 * Formats the source file of a route for an error message, when known.
 */
function inFile(filePath: string | undefined): string {
  return filePath === undefined ? "" : ` ("${filePath}")`;
}

/**
 * Validates one param value returned by `generateStaticParams()` and returns
 * it. Values are substituted verbatim into URL paths (and output file
 * paths), so a value the route's own URLPattern cannot match back — or one
 * that escapes the output directory — must fail the build instead of
 * producing a silently broken page.
 */
function substituteParamValue(
  segment: string,
  params: Record<string, string>,
  routePath: string,
  filePath: string | undefined,
): string {
  const name = paramName(segment);
  const where = `generateStaticParams() for "${routePath}"${inFile(filePath)}`;
  const value: unknown = params[name];
  if (value === undefined) {
    throw new Error(`${where} is missing a value for param "${name}".`);
  }
  if (typeof value !== "string") {
    throw new Error(
      `${where} returned a ${typeof value} for param "${name}". ` +
        `Param values must be strings.`,
    );
  }
  const isCatchAll = segment.endsWith("*");
  if (value === "") {
    throw new Error(
      isCatchAll
        ? `${where} returned an empty value for catch-all param "${name}". ` +
            `A zero-segment catch-all page cannot be statically served; ` +
            `create a page for the parent route instead.`
        : `${where} returned an empty value for param "${name}".`,
    );
  }
  const parts = value.split("/");
  if (!isCatchAll && parts.length > 1) {
    throw new Error(
      `${where} returned "${value}" for param "${name}", which contains "/". ` +
        `Only a catch-all param (":${name}*") may span multiple URL segments.`,
    );
  }
  for (const part of parts) {
    if (part === "") {
      throw new Error(
        `${where} returned "${value}" for catch-all param "${name}". ` +
          `Values must not contain leading, trailing, or repeated slashes.`,
      );
    }
    if (part === "." || part === "..") {
      throw new Error(
        `${where} returned "${value}" for param "${name}". ` +
          `Values must not contain "." or ".." segments.`,
      );
    }
  }
  if (value.includes("?") || value.includes("#")) {
    throw new Error(
      `${where} returned "${value}" for param "${name}". ` +
        `Values must not contain "?" or "#", which cannot appear in a URL path.`,
    );
  }
  return value;
}

async function addPagesForLeaf(
  segments: string[],
  module: FsRouteModule,
  pages: StaticPage[],
  filePath: string | undefined,
  chain: FsRouteTreeNode[],
): Promise<void> {
  const dynamicSegments = segments.filter(isDynamicSegment);

  if (dynamicSegments.length === 0) {
    pages.push({ urlPath: segmentsToUrl(segments), params: {}, chain });
    return;
  }

  const generate = module.generateStaticParams;
  if (isClientReference(generate)) {
    throw new Error(
      `Dynamic route "${segmentsToUrl(segments)}"${inFile(filePath)} exports ` +
        `generateStaticParams() from a module marked "use client". ` +
        `generateStaticParams() runs on the server at build time, so a page module ` +
        `cannot be a Client Component. Move the component body into a separate ` +
        `"use client" module and re-export it from the page: ` +
        `export { default } from "./_page";`,
    );
  }
  if (typeof generate !== "function") {
    throw new Error(
      `Dynamic route "${segmentsToUrl(segments)}"${inFile(filePath)} has no generateStaticParams() export. ` +
        `Every page of a static site must be enumerated at build time; ` +
        `export generateStaticParams() from the page module to list the params to pre-render.`,
    );
  }

  const paramSets = await generate();
  const routePath = segmentsToUrl(segments);
  for (const params of paramSets) {
    const concreteSegments = segments.map((segment) => {
      if (!isDynamicSegment(segment)) return segment;
      return substituteParamValue(segment, params, routePath, filePath);
    });
    pages.push({ urlPath: segmentsToUrl(concreteSegments), params, chain });
  }
}

async function walk(
  nodes: FsRouteTreeNode[],
  prefixSegments: string[],
  prefixChain: FsRouteTreeNode[],
  pages: StaticPage[],
): Promise<void> {
  for (const node of nodes) {
    const ownSegments =
      node.path !== undefined ? splitRoutePath(node.path) : [];
    const segments = [...prefixSegments, ...ownSegments];
    const chain = [...prefixChain, node];
    if (node.page) {
      await addPagesForLeaf(segments, node.module, pages, node.filePath, chain);
    }
    if (node.children) {
      await walk(node.children, segments, chain, pages);
    }
  }
}

/**
 * Formats a page node for a URL-collision error message.
 */
function describePage(node: FsRouteTreeNode): string {
  return node.filePath !== undefined
    ? `"${node.filePath}"`
    : `route "${node.path ?? "(pathless)"}"`;
}

/**
 * Walks a route tree and enumerates every page to statically generate.
 *
 * Static routes are emitted directly. Dynamic routes (with `:param` or
 * catch-all segments) are expanded using each page module's
 * `generateStaticParams()`; a dynamic route without that export fails the
 * build, since a static site cannot serve pages that were not enumerated at
 * build time.
 *
 * Duplicate params returned by one `generateStaticParams()` are collapsed
 * into a single page. Two *different* routes generating the same URL (e.g. a
 * static page next to a dynamic sibling whose params resolve to it) fail the
 * build: the pages would fight over one output file, and route precedence
 * makes one of them unreachable.
 */
export async function collectStaticPaths(
  tree: FsRouteTreeNode[],
): Promise<StaticPage[]> {
  const pages: StaticPage[] = [];
  await walk(tree, [], [], pages);
  const byUrl = new Map<string, StaticPage>();
  const deduped: StaticPage[] = [];
  for (const page of pages) {
    const existing = byUrl.get(page.urlPath);
    if (existing === undefined) {
      byUrl.set(page.urlPath, page);
      deduped.push(page);
      continue;
    }
    const existingLeaf = existing.chain[existing.chain.length - 1]!;
    const leaf = page.chain[page.chain.length - 1]!;
    if (existingLeaf === leaf) {
      // The same page enumerated twice (generateStaticParams() returned
      // duplicate params); the pages would be identical, so keep the first.
      continue;
    }
    throw new Error(
      `Two pages (${describePage(existingLeaf)} and ${describePage(leaf)}) ` +
        `generate the same URL "${page.urlPath}". A URL can be generated by ` +
        `only one page; remove the conflicting value from ` +
        `generateStaticParams() or delete one of the pages.`,
    );
  }
  return deduped;
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

import type {
  FsRouteFile,
  FsRouteModule,
  FsRouteTreeNode,
  FsRoutesAdapter,
} from "./types";

/**
 * Options for the built-in Next.js-like adapter.
 */
export interface NextRoutesOptions {
  /**
   * Base file name (without extension) that marks a page.
   * @default "page"
   */
  pageFileName?: string;
  /**
   * Base file name (without extension) that marks a layout.
   * @default "layout"
   */
  layoutFileName?: string;
}

interface TrieNode {
  /** Raw directory segment name (`""` for the routes-directory root). */
  segment: string;
  page?: FsRouteModule;
  layout?: FsRouteModule;
  children: Map<string, TrieNode>;
}

type FileKind = "page" | "layout";

/**
 * Splits a relative file path into its directory segments and base file name.
 */
function splitFilePath(filePath: string): { dirs: string[]; base: string } {
  const parts = filePath.split("/").filter(Boolean);
  const base = parts.pop() ?? "";
  return { dirs: parts, base };
}

/**
 * Classifies a base file name as a page, a layout, or `undefined` (ignored).
 */
function classify(
  base: string,
  pageFileName: string,
  layoutFileName: string,
): FileKind | undefined {
  const dot = base.lastIndexOf(".");
  const name = dot === -1 ? base : base.slice(0, dot);
  if (name === pageFileName) return "page";
  if (name === layoutFileName) return "layout";
  return undefined;
}

/**
 * Rejects directory segments using Next.js syntaxes that this adapter does not
 * support, so they fail loudly instead of silently producing broken routes.
 */
function validateSegment(segment: string, filePath: string): void {
  if (/^\[\[.*\]\]$/.test(segment)) {
    throw new Error(
      `Optional catch-all segments ("${segment}" in "${filePath}") are not supported. ` +
        `Use a catch-all segment ([...param]) plus a separate page for the parent route instead.`,
    );
  }
  if (segment.startsWith("@")) {
    throw new Error(
      `Parallel route slots ("${segment}" in "${filePath}") are not supported.`,
    );
  }
  if (/^\(\.{1,3}\)/.test(segment)) {
    throw new Error(
      `Intercepting routes ("${segment}" in "${filePath}") are not supported.`,
    );
  }
}

/**
 * Converts a directory segment to its URL contribution in FUNSTACK Router
 * syntax, or `null` when the segment does not affect the URL.
 *
 * - `""` (root) → `null`
 * - `(group)` route group → `null`
 * - `[...slug]` catch-all → `":slug*"`
 * - `[slug]` dynamic → `":slug"`
 * - `about` → `"about"`
 */
function urlSegment(segment: string): string | null {
  if (segment === "") return null;
  if (segment.startsWith("(") && segment.endsWith(")")) return null;
  const catchAll = /^\[\.\.\.(.+)\]$/.exec(segment);
  if (catchAll) return `:${catchAll[1]}*`;
  const dynamic = /^\[(.+)\]$/.exec(segment);
  if (dynamic) return `:${dynamic[1]}`;
  return segment;
}

/**
 * Matching specificity of a router URL segment: static segments match before
 * dynamic ones, which match before catch-alls.
 */
function segmentRank(segment: string): number {
  if (!segment.startsWith(":")) return 0;
  return segment.endsWith("*") ? 2 : 1;
}

/**
 * Per-segment specificity ranks of a route node, used to order sibling routes.
 *
 * A pathless layout (a layout in a route group) consumes no pathname itself,
 * so it is ranked by its greediest descendants: the element-wise maximum of
 * its children's rank vectors.
 */
function rankVector(node: FsRouteTreeNode): number[] {
  if (node.path !== undefined) {
    return node.path.split("/").filter(Boolean).map(segmentRank);
  }
  const vectors = (node.children ?? []).map(rankVector);
  const length = Math.max(0, ...vectors.map((vector) => vector.length));
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    result.push(Math.max(0, ...vectors.map((vector) => vector[i] ?? 0)));
  }
  return result;
}

/**
 * Orders sibling routes so that more specific routes match first: FUNSTACK
 * Router matches routes in definition order (first match wins), so a dynamic
 * or catch-all route emitted before a static sibling would shadow it.
 *
 * The sort is stable; equally-ranked siblings keep their alphabetical order.
 */
function compareNodes(a: FsRouteTreeNode, b: FsRouteTreeNode): number {
  const rankA = rankVector(a);
  const rankB = rankVector(b);
  const length = Math.min(rankA.length, rankB.length);
  for (let i = 0; i < length; i++) {
    if (rankA[i] !== rankB[i]) return rankA[i]! - rankB[i]!;
  }
  return rankA.length - rankB.length;
}

function ensureDir(root: TrieNode, dirs: string[]): TrieNode {
  let current = root;
  for (const segment of dirs) {
    let next = current.children.get(segment);
    if (!next) {
      next = { segment, children: new Map() };
      current.children.set(segment, next);
    }
    current = next;
  }
  return current;
}

/**
 * Converts a trie node into route tree nodes.
 *
 * `prefix` holds URL segments contributed by ancestor directories that did not
 * introduce a layout (and therefore did not open a nesting boundary). A
 * directory with a `layout` opens a nesting boundary: it becomes a parent route
 * consuming `prefix + ownSegment`, and its descendants are emitted relative to
 * it (with an empty prefix).
 */
function emit(node: TrieNode, prefix: string[]): FsRouteTreeNode[] {
  const segment = urlSegment(node.segment);
  const here = segment === null ? prefix : [...prefix, segment];

  // Deterministic ordering by raw segment name.
  const childNodes = [...node.children.values()].sort((a, b) =>
    a.segment < b.segment ? -1 : a.segment > b.segment ? 1 : 0,
  );

  if (node.layout) {
    const children: FsRouteTreeNode[] = [];
    if (node.page) {
      children.push({ path: "/", module: node.page, page: true });
    }
    for (const child of childNodes) {
      children.push(...emit(child, []));
    }
    children.sort(compareNodes);
    const path = here.length === 0 ? undefined : `/${here.join("/")}`;
    return [{ path, module: node.layout, page: false, children }];
  }

  const result: FsRouteTreeNode[] = [];
  if (node.page) {
    const path = here.length === 0 ? "/" : `/${here.join("/")}`;
    result.push({ path, module: node.page, page: true });
  }
  for (const child of childNodes) {
    result.push(...emit(child, here));
  }
  result.sort(compareNodes);
  return result;
}

/**
 * Creates a Next.js-like file-system routing adapter (App-Router conventions).
 *
 * Conventions:
 * - `page.{tsx,jsx}` — a page for its directory.
 * - `layout.{tsx,jsx}` — a layout wrapping its directory and descendants. The
 *   layout component must render `<Outlet />` where children should appear.
 * - `[param]` directory — a dynamic segment (`:param`).
 * - `[...param]` directory — a catch-all segment.
 * - `(group)` directory — a route group that does not affect the URL.
 *
 * Other files in the routes directory are ignored, so helpers and components
 * may be co-located with routes.
 *
 * Sibling routes are ordered by specificity — static segments match before
 * dynamic segments, which match before catch-alls — so a dynamic route never
 * shadows a static sibling.
 *
 * `buildRoutes` throws on unsupported Next.js syntaxes (optional catch-all
 * `[[...param]]`, parallel route slots `@slot`, intercepting routes
 * `(.)segment`) and on conflicting route files (two pages resolving to the
 * same route, or duplicate page/layout files in one directory).
 *
 * @experimental File-system routing is experimental and not yet subject to
 * semantic versioning.
 */
export function nextRoutes(options: NextRoutesOptions = {}): FsRoutesAdapter {
  const pageFileName = options.pageFileName ?? "page";
  const layoutFileName = options.layoutFileName ?? "layout";

  return {
    name: "next",
    buildRoutes(files: FsRouteFile[]): FsRouteTreeNode[] {
      const root: TrieNode = { segment: "", children: new Map() };
      // Route position each page/layout occupies, with dynamic segments
      // normalized so that e.g. `[a]` and `[b]` at the same position conflict.
      // Exact directory each page/layout file lives in, to detect duplicate
      // files for the same node (e.g. `page.tsx` next to `page.jsx`).
      const filesByDir = new Map<string, string>();
      // Route position of each page, with dynamic segments normalized so that
      // e.g. `[a]` and `[b]` pages at the same position conflict. Layouts are
      // exempt: multiple layouts at one position via route groups are valid
      // (e.g. `(marketing)/layout.tsx` and `(shop)/layout.tsx`).
      const pagePositions = new Map<string, string>();
      for (const file of files) {
        const { dirs, base } = splitFilePath(file.filePath);
        const kind = classify(base, pageFileName, layoutFileName);
        if (!kind) continue;
        for (const segment of dirs) {
          validateSegment(segment, file.filePath);
        }
        const dirKey = `${kind} ${dirs.join("/")}`;
        const sameDir = filesByDir.get(dirKey);
        if (sameDir !== undefined) {
          throw new Error(
            `Duplicate ${kind} files "${sameDir}" and "${file.filePath}": ` +
              `a directory may contain only one ${kind} file.`,
          );
        }
        filesByDir.set(dirKey, file.filePath);
        if (kind === "page") {
          const position = dirs
            .map(urlSegment)
            .filter((segment) => segment !== null)
            .map((segment) =>
              segment.startsWith(":")
                ? segment.endsWith("*")
                  ? "[...]"
                  : "[]"
                : segment,
            )
            .join("/");
          const conflicting = pagePositions.get(position);
          if (conflicting !== undefined) {
            throw new Error(
              `Route files "${conflicting}" and "${file.filePath}" conflict: ` +
                `they resolve to the same route. Routes are matched first-match-wins, ` +
                `so one of the pages would never be reachable.`,
            );
          }
          pagePositions.set(position, file.filePath);
        }
        const node = ensureDir(root, dirs);
        if (kind === "page") {
          node.page = file.module;
        } else {
          node.layout = file.module;
        }
      }
      return emit(root, []);
    },
  };
}

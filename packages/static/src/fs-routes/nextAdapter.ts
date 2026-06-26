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
 */
export function nextRoutes(options: NextRoutesOptions = {}): FsRoutesAdapter {
  const pageFileName = options.pageFileName ?? "page";
  const layoutFileName = options.layoutFileName ?? "layout";

  return {
    name: "next",
    buildRoutes(files: FsRouteFile[]): FsRouteTreeNode[] {
      const root: TrieNode = { segment: "", children: new Map() };
      for (const file of files) {
        const { dirs, base } = splitFilePath(file.filePath);
        const kind = classify(base, pageFileName, layoutFileName);
        if (!kind) continue;
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

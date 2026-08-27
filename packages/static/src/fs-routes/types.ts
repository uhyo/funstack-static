import type { RouteHandle } from "@funstack/router";
import type { ComponentType, ReactNode } from "react";

export type MaybePromise<T> = T | Promise<T>;

/**
 * Opaque route object identifying the route of a page or layout, received as
 * the `route` prop. Give it to FUNSTACK Router's typed hooks
 * (`useRouteParams(route)`, in a Client Component) to read the params of the
 * URL currently shown, which may differ from a Server Component's build-time
 * `params` prop after soft client-side navigation between pages of the same
 * dynamic route.
 *
 * The `Params` type argument describes the route's dynamic params; like the
 * `params` prop it is not verified against the route's actual path.
 *
 * @experimental File-system routing is experimental and not yet subject to
 * semantic versioning.
 */
export type FsRouteObject<
  Params extends Record<string, string> = Record<string, string>,
> = RouteHandle<string, Params, unknown, undefined>;

/**
 * Props received by every page or layout under file-system routing: the
 * route's dynamic `params`, and the {@link FsRouteObject | route object}
 * identifying its route.
 *
 * A Server Component receives exactly these props, with the `params` the
 * page was generated with. A Client Component is rendered by FUNSTACK Router
 * with the live `params` of the current match, plus the router's other route
 * component props; these two are the subset shared by both kinds.
 *
 * @experimental File-system routing is experimental and not yet subject to
 * semantic versioning.
 */
export interface FsRouteComponentProps<
  Params extends Record<string, string> = Record<string, string>,
> {
  /**
   * Dynamic route params. Build-time values for a Server Component; live
   * values for a Client Component.
   */
  params: Params;
  /** Opaque route object for FUNSTACK Router's typed hooks. */
  route: FsRouteObject<Params>;
}

/**
 * Module shape for a discovered route file (a page or a layout).
 *
 * Route files `export default` a React component. Page modules may also
 * `export` a `generateStaticParams` function to enumerate concrete params
 * for dynamic routes (modeled after Next.js).
 */
export interface FsRouteModule {
  /** The component for this page or layout. */
  default?:
    | ComponentType<FsRouteComponentProps>
    | ComponentType<{ params: Record<string, string> }>
    | ComponentType;
  /**
   * Function used to statically generate a dynamic route. Required for pages
   * whose route contains a dynamic segment; the build fails without it, since
   * a static site cannot serve pages that were not enumerated at build time.
   *
   * Runs on the server at build time, so the exporting module cannot be
   * marked `"use client"`; move the page body into a separate `"use client"`
   * module and re-export it as `default` instead.
   *
   * Returns the list of concrete params to pre-render. Each entry maps every
   * dynamic param name in the route's path to a concrete string value. For a
   * catch-all segment, the value may contain slashes.
   */
  generateStaticParams?: () => MaybePromise<Array<Record<string, string>>>;
  [key: string]: unknown;
}

/**
 * A route file discovered in the routes directory.
 */
export interface FsRouteFile {
  /**
   * Path relative to the routes directory, using POSIX separators and
   * including the file extension.
   *
   * Examples: `"page.tsx"`, `"about/page.tsx"`, `"blog/[slug]/page.tsx"`.
   */
  filePath: string;
  /** The eagerly-imported module for this file. */
  module: FsRouteModule;
}

/**
 * A node in the route tree produced by an adapter.
 *
 * The framework converts this tree both into FUNSTACK Router route definitions
 * and into the list of pages to statically generate.
 */
export interface FsRouteTreeNode {
  /**
   * Path segment(s) for this node relative to its parent, in FUNSTACK Router
   * syntax (leading slash). Examples: `"/"`, `"/blog"`, `"/:slug"`,
   * `"/docs/:slug*"`.
   *
   * `undefined` makes this a pathless layout route that always matches and
   * consumes no pathname.
   */
  path?: string;
  /** The module providing this node's component (page or layout). */
  module: FsRouteModule;
  /**
   * Path of the file that provided this node's module, relative to the routes
   * directory (as in {@link FsRouteFile.filePath}). Adapters should set this
   * so that error messages can name the offending file.
   */
  filePath?: string;
  /**
   * Whether this node is a concrete page that should be statically generated.
   * Layout nodes set this to `false`.
   */
  page: boolean;
  /** Child route nodes. */
  children?: FsRouteTreeNode[];
}

/**
 * An adapter that maps file-system naming conventions to a route tree.
 *
 * Implement this interface to support a custom directory / file-name
 * convention. A Next.js-like adapter is provided built-in via `nextRoutes()`.
 *
 * @experimental File-system routing is experimental and not yet subject to
 * semantic versioning.
 */
export interface FsRoutesAdapter {
  /** Adapter name, used in diagnostics. */
  name: string;
  /** Build a route tree from the discovered route files. */
  buildRoutes(files: FsRouteFile[]): FsRouteTreeNode[];
}

/**
 * The root (HTML shell) component type used by file-system routing.
 */
export type FsRootComponent = ComponentType<{ children: ReactNode }>;

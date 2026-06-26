import type { ComponentType, ReactNode } from "react";

export type MaybePromise<T> = T | Promise<T>;

/**
 * Module shape for a discovered route file (a page or a layout).
 *
 * Route files `export default` a React component. Page modules may also
 * `export` a `generateStaticParams` function to enumerate concrete params
 * for dynamic routes (modeled after Next.js).
 */
export interface FsRouteModule {
  /** The component for this page or layout. */
  default?: ComponentType<{ params: Record<string, string> }> | ComponentType;
  /**
   * Optional function used to statically generate a dynamic route.
   *
   * Returns the list of concrete params to pre-render. Each entry maps every
   * dynamic param name in the route's path to a concrete string value. For a
   * catch-all segment, the value may contain slashes.
   *
   * Without this export, a dynamic route is not pre-rendered to HTML (it still
   * works on the client via the SPA fallback).
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

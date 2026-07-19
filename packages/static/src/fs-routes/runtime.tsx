import { createElement } from "react";
import { Router } from "@funstack/router";
import type { RouteDefinition } from "@funstack/router/server";
import type {
  FsRootComponent,
  FsRouteModule,
  FsRoutesAdapter,
  FsRouteTreeNode,
} from "./types";
import type { EntryDefinition, GetEntriesResult } from "../entryDefinition";
import { nextRoutes } from "./nextAdapter";
import {
  collectStaticPaths,
  modulesToRouteFiles,
  urlPathToFilePath,
} from "./tree";

/**
 * Options for {@link createFsRoutesEntries}.
 *
 * @experimental File-system routing is experimental and not yet subject to
 * semantic versioning.
 */
export interface CreateFsRoutesOptions {
  /**
   * The result of `import.meta.glob` (eager) over the routes directory, keyed
   * by file path. Glob your pages directory from your entries module, e.g.
   * `import.meta.glob("./pages/**\/*.{tsx,jsx}", { eager: true })`.
   */
  modules: Record<string, FsRouteModule>;
  /**
   * The routes directory that the `modules` keys are relative to — the
   * directory your `import.meta.glob` pattern starts with, e.g. `"./pages"`
   * or `"/src/pages"`.
   *
   * When provided, this prefix is stripped from every module key
   * deterministically. When omitted, the longest common directory prefix
   * across all keys is stripped instead; that heuristic misdetects the routes
   * root when every page happens to live under one shared subdirectory, so
   * passing `base` is recommended.
   */
  base?: string;
  /**
   * The root (HTML shell) component. Renders the whole page
   * (`<html>…<body>{children}</body></html>`).
   */
  root: FsRootComponent;
  /**
   * The convention adapter mapping files to a route tree.
   *
   * @default nextRoutes()
   */
  adapter?: FsRoutesAdapter;
}

/**
 * Builds FUNSTACK Router state for file-system routing and returns a
 * `getEntries` function (the default export expected by the `entries` plugin
 * option). One entry is produced per statically-generated page.
 *
 * The route tree is built once via the adapter; the router route definitions
 * are rebuilt per page so that concrete dynamic `params` can be passed to the
 * route components.
 *
 * @experimental File-system routing is experimental and not yet subject to
 * semantic versioning. Its API may change in a minor release.
 *
 * @example
 * ```tsx
 * // src/entries.tsx
 * import { createFsRoutesEntries } from "@funstack/static/fs-routes";
 * import Root from "./root";
 *
 * const modules = import.meta.glob("./pages/**\/*.{tsx,jsx}", { eager: true });
 *
 * export default createFsRoutesEntries({ modules, base: "./pages", root: Root });
 * ```
 */
export function createFsRoutesEntries(
  options: CreateFsRoutesOptions,
): () => GetEntriesResult {
  const { modules, base, root: Root, adapter = nextRoutes() } = options;

  function buildRouteDefinitions(
    nodes: FsRouteTreeNode[],
    params: Record<string, string>,
  ): RouteDefinition[] {
    return nodes.map((node): RouteDefinition => {
      const Component = node.module.default;
      const definition: {
        path?: string;
        component?: React.ReactNode;
        children?: RouteDefinition[];
      } = {};
      if (node.path !== undefined) {
        definition.path = node.path;
      }
      if (Component) {
        definition.component = createElement(
          Component as React.ComponentType<{ params: Record<string, string> }>,
          { params },
        );
      }
      if (node.children) {
        definition.children = buildRouteDefinitions(node.children, params);
      }
      return definition;
    });
  }

  function FsRoutesApp({
    tree,
    path,
    params,
  }: {
    tree: FsRouteTreeNode[];
    path: string;
    params: Record<string, string>;
  }): React.ReactNode {
    const routes = buildRouteDefinitions(tree, params);
    return createElement(Router, { routes, fallback: "static", ssr: { path } });
  }

  return async function* getEntries(): AsyncGenerator<EntryDefinition> {
    const warn = (message: string) => {
      console.warn(`[funstack] ${message}`);
    };
    const files = modulesToRouteFiles(modules, { onWarn: warn, base });
    const tree = adapter.buildRoutes(files);
    const pages = await collectStaticPaths(tree);
    for (const { urlPath, params } of pages) {
      yield {
        path: urlPathToFilePath(urlPath),
        root: { default: Root },
        app: createElement(FsRoutesApp, { tree, path: urlPath, params }),
      };
    }
  };
}

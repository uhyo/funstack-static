import { createElement } from "react";
import { Router } from "@funstack/router";
import type { RouteDefinition } from "@funstack/router/server";
import type {
  FsRootComponent,
  FsRouteFile,
  FsRouteModule,
  FsRoutesAdapter,
  FsRouteTreeNode,
} from "./types";
import type { EntryDefinition, GetEntriesResult } from "../entryDefinition";
import { collectStaticPaths, urlPathToFilePath } from "./tree";

/**
 * Options for {@link createFsRoutesEntries}.
 */
export interface CreateFsRoutesOptions {
  /**
   * The result of `import.meta.glob` (eager) over the routes directory,
   * keyed by file path.
   */
  modules: Record<string, FsRouteModule>;
  /**
   * The glob base (root-relative directory, e.g. `"/src/pages"`) to strip from
   * the module keys when computing each file's path relative to the routes
   * directory.
   */
  base: string;
  /** The convention adapter mapping files to a route tree. */
  adapter: FsRoutesAdapter;
  /** The root (HTML shell) component. */
  Root: FsRootComponent;
}

/**
 * Converts the eager-glob result into the list of files relative to the routes
 * directory.
 */
function modulesToFiles(
  modules: Record<string, FsRouteModule>,
  base: string,
): FsRouteFile[] {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  const files: FsRouteFile[] = [];
  for (const [key, module] of Object.entries(modules)) {
    const filePath = key.startsWith(prefix) ? key.slice(prefix.length) : key;
    files.push({ filePath, module });
  }
  return files;
}

/**
 * Builds the FUNSTACK Router state for file-system routing and returns a
 * `getEntries` function that yields one entry per statically-generated page.
 *
 * The route tree is built once via the adapter; the router route definitions
 * are rebuilt per page so that concrete dynamic `params` can be passed to the
 * route components.
 */
export function createFsRoutesEntries(
  options: CreateFsRoutesOptions,
): () => GetEntriesResult {
  const { modules, base, adapter, Root } = options;
  const files = modulesToFiles(modules, base);
  const tree = adapter.buildRoutes(files);

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
    path,
    params,
  }: {
    path: string;
    params: Record<string, string>;
  }): React.ReactNode {
    const routes = buildRouteDefinitions(tree, params);
    return createElement(Router, { routes, fallback: "static", ssr: { path } });
  }

  return async function* getEntries(): AsyncGenerator<EntryDefinition> {
    const pages = await collectStaticPaths(tree, (message) => {
      console.warn(`[funstack] ${message}`);
    });
    for (const { urlPath, params } of pages) {
      yield {
        path: urlPathToFilePath(urlPath),
        root: { default: Root },
        app: createElement(FsRoutesApp, { path: urlPath, params }),
      };
    }
  };
}

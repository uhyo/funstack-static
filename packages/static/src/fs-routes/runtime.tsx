import { createElement } from "react";
import { Router } from "@funstack/router";
import type { RouteDefinition } from "@funstack/router/server";
import type {
  FsRootComponent,
  FsRouteComponentProps,
  FsRouteModule,
  FsRouteObject,
  FsRoutesAdapter,
  FsRouteTreeNode,
} from "./types";
import type { EntryDefinition, GetEntriesResult } from "../entryDefinition";
import { nextRoutes } from "./nextAdapter";
import {
  collectStaticPaths,
  isClientReference,
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
   * This prefix is stripped from every module key to make route paths
   * relative to the routes directory. The build fails if it does not prefix
   * every key.
   */
  base: string;
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
    idPrefix: string,
  ): RouteDefinition[] {
    return nodes.map((node, index): RouteDefinition => {
      const Component = node.module.default;
      // Unique id (by tree position) so that the route object passed to the
      // component resolves to this route's context in the typed hooks; the
      // file path is appended for legible debugging output.
      const id = `${idPrefix}${index}${
        node.filePath === undefined ? "" : ` ${node.filePath}`
      }`;
      const definition: {
        id: string;
        path?: string;
        component?: React.ComponentType<object> | React.ReactNode;
        children?: RouteDefinition[];
      } = { id };
      if (node.path !== undefined) {
        definition.path = node.path;
      }
      if (Component) {
        if (isClientReference(Component)) {
          // A Client Component crosses the RSC boundary as a reference, so
          // the router can render it in the browser. Pass the component
          // itself so it receives the params of the current match, keeping
          // them live across soft client-side navigation.
          definition.component = Component as React.ComponentType<object>;
        } else {
          // A Server Component crosses the RSC boundary only as its rendered
          // output, so it must be rendered here with the build-time params.
          // The route object lets Client Components below it read the live
          // params through FUNSTACK Router's typed hooks.
          // The typed hooks resolve a route object by its runtime `id`; the
          // branding symbol of `PartialRouteDefinition` is type-level only.
          const route = { id } as unknown as FsRouteObject;
          definition.component = createElement(
            Component as React.ComponentType<FsRouteComponentProps>,
            { params, route },
          );
        }
      }
      if (node.children) {
        definition.children = buildRouteDefinitions(
          node.children,
          params,
          `${idPrefix}${index}.`,
        );
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
    const routes = buildRouteDefinitions(tree, params, "");
    return createElement(Router, { routes, fallback: "static", ssr: { path } });
  }

  return async function* getEntries(): AsyncGenerator<EntryDefinition> {
    const warn = (message: string) => {
      console.warn(`[funstack] ${message}`);
    };
    const files = modulesToRouteFiles(modules, base, warn);
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

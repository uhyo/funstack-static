import {
  createElement,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";
import { Router } from "@funstack/router";
import type { RouteDefinition } from "@funstack/router/server";
import type {
  FsRootComponent,
  FsRouteModule,
  FsRouteObject,
  FsRoutesAdapter,
  FsRouteTreeNode,
} from "./types";
import type { EntryDefinition, GetEntriesResult } from "../entryDefinition";
import { nextRoutes } from "./nextAdapter";
import {
  collectStaticPaths,
  isDynamicSegment,
  modulesToRouteFiles,
  paramName,
  splitRoutePath,
  urlPathToFilePath,
  type StaticPage,
} from "./tree";
import { isClientReference } from "../util/clientReference";
import { paramsKey, pickParams, type FsRouteSlotProps } from "./slot";

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
 * Environment-specific services injected into the fs-routes runtime. The
 * real host (attached by `createFsRoutesEntries` in `./entries`) uses the
 * RSC runtime's defer registry; tests supply a fake to keep this module
 * importable outside a Vite RSC environment.
 */
export interface FsRoutesRuntimeHost {
  /**
   * Registers a pre-rendered RSC chunk for a Server Component route node
   * with one concrete params combination. Returns the payload ID under
   * which the chunk is served (and baked into the slot's `chunks` map).
   * `name` is a debugging label for build logs.
   */
  registerChunk(element: ReactElement, name: string): string;
  /**
   * The client component standing in for Server Component route nodes,
   * resolving the chunk for the current match's params. A client reference
   * to `FsRouteSlot` from `#rsc-client` in the real host.
   */
  RouteSlot: ComponentType<FsRouteSlotProps>;
}

/**
 * Per-node routing metadata shared by every generated page: the stable
 * definition id, the dynamic params visible to the node, and (for Server
 * Component nodes) the registered chunk for each generated params
 * combination.
 */
interface NodeMeta {
  id: string;
  route: FsRouteObject;
  /** Dynamic param names consumed by segments at or above this node. */
  paramNames: string[];
  /**
   * Chunk payload ID by params key, for Server Component nodes. Filled by
   * chunk registration before any page is yielded.
   */
  chunks: Record<string, string>;
}

/**
 * Rejects route modules without a default export. Rendering would silently
 * skip the missing component (producing a blank page, or a pass-through
 * layout), so a typo'd or forgotten export must fail the build instead.
 */
function validateRouteModules(nodes: FsRouteTreeNode[]): void {
  for (const node of nodes) {
    if (node.module.default === undefined) {
      const kind = node.page ? "page" : "layout";
      const which =
        node.filePath === undefined
          ? `for route "${node.path ?? "(pathless)"}"`
          : `"${node.filePath}"`;
      throw new Error(
        `Route ${kind} module ${which} has no default export. ` +
          `Page and layout modules must \`export default\` a React component.`,
      );
    }
    if (node.children) {
      validateRouteModules(node.children);
    }
  }
}

function buildNodeMetas(
  nodes: FsRouteTreeNode[],
  inheritedParamNames: string[],
  idPrefix: string,
  into: Map<FsRouteTreeNode, NodeMeta>,
): void {
  nodes.forEach((node, index) => {
    // Unique id (by tree position) so that the route object passed to the
    // component resolves to this route's context in the typed hooks; the
    // file path is appended for legible debugging output.
    const id = `${idPrefix}${index}${
      node.filePath === undefined ? "" : ` ${node.filePath}`
    }`;
    const ownParamNames =
      node.path === undefined
        ? []
        : splitRoutePath(node.path).filter(isDynamicSegment).map(paramName);
    const paramNames = [...inheritedParamNames, ...ownParamNames];
    // The typed hooks resolve a route object by its runtime `id`; the
    // branding symbol of `RouteHandle` is type-level only.
    const route = { id } as unknown as FsRouteObject;
    into.set(node, { id, route, paramNames, chunks: {} });
    if (node.children) {
      buildNodeMetas(node.children, paramNames, `${idPrefix}${index}.`, into);
    }
  });
}

/**
 * Registers one pre-rendered RSC chunk per Server Component node per params
 * combination occurring among the generated pages, filling each node's
 * `chunks` map. Client-side soft navigation fetches these chunks to render
 * Server Component output for the destination's params.
 */
function registerChunks(
  pages: StaticPage[],
  metas: Map<FsRouteTreeNode, NodeMeta>,
  host: FsRoutesRuntimeHost,
): void {
  const combos = new Map<
    FsRouteTreeNode,
    Map<string, Record<string, string>>
  >();
  for (const page of pages) {
    for (const node of page.chain) {
      const Component = node.module.default;
      if (!Component || isClientReference(Component)) {
        continue;
      }
      const meta = metas.get(node)!;
      let nodeCombos = combos.get(node);
      if (!nodeCombos) {
        nodeCombos = new Map();
        combos.set(node, nodeCombos);
      }
      const key = paramsKey(meta.paramNames, page.params);
      if (!nodeCombos.has(key)) {
        nodeCombos.set(key, pickParams(page.params, meta.paramNames));
      }
    }
  }
  for (const [node, nodeCombos] of combos) {
    const meta = metas.get(node)!;
    const Component = node.module.default!;
    for (const [key, params] of nodeCombos) {
      const element = createElement(Component, { params, route: meta.route });
      meta.chunks[key] = host.registerChunk(
        element,
        `fs-route ${node.filePath ?? meta.id} ${key}`,
      );
    }
  }
}

/**
 * Builds FUNSTACK Router state for file-system routing and returns a
 * `getEntries` function (the default export expected by the `entries` plugin
 * option). One entry is produced per statically-generated page.
 *
 * The route tree is built once via the adapter; the router route definitions
 * are rebuilt per page so that the page's own Server Component output can be
 * inlined into its payload.
 *
 * This is the host-parameterized implementation behind
 * `createFsRoutesEntries` (see `./entries`), kept free of RSC-runtime
 * imports so it stays testable outside a Vite environment.
 */
export function createFsRoutesEntriesWithHost(
  options: CreateFsRoutesOptions,
  host: FsRoutesRuntimeHost,
): () => GetEntriesResult {
  const { modules, base, root: Root, adapter = nextRoutes() } = options;

  function buildRouteDefinitions(
    nodes: FsRouteTreeNode[],
    metas: Map<FsRouteTreeNode, NodeMeta>,
    pageChain: Set<FsRouteTreeNode>,
    pageParams: Record<string, string>,
  ): RouteDefinition[] {
    return nodes.map((node): RouteDefinition => {
      const meta = metas.get(node)!;
      const Component = node.module.default;
      const definition: {
        id: string;
        path?: string;
        component?: ComponentType<object> | ReactNode;
        children?: RouteDefinition[];
      } = { id: meta.id };
      if (node.path !== undefined) {
        definition.path = node.path;
      }
      if (Component) {
        if (isClientReference(Component)) {
          // A Client Component crosses the RSC boundary as a reference, so
          // the router can render it in the browser. Pass the component
          // itself so it receives the params of the current match, keeping
          // them live across soft client-side navigation.
          definition.component = Component as ComponentType<object>;
        } else {
          // A Server Component crosses the RSC boundary only as its rendered
          // output, so a client slot stands in for it: it renders the
          // build-time output while the current params match this page's,
          // and fetches the destination's pre-rendered chunk after a soft
          // client-side navigation. Output is inlined only for nodes this
          // page renders through; other nodes always resolve via chunks.
          const slotProps: FsRouteSlotProps = {
            route: meta.route,
            paramNames: meta.paramNames,
            chunks: meta.chunks,
          };
          if (pageChain.has(node)) {
            const params = pickParams(pageParams, meta.paramNames);
            slotProps.initialKey = paramsKey(meta.paramNames, pageParams);
            slotProps.initial = createElement(Component, {
              params,
              route: meta.route,
            });
          }
          definition.component = createElement(host.RouteSlot, slotProps);
        }
      }
      if (node.children) {
        definition.children = buildRouteDefinitions(
          node.children,
          metas,
          pageChain,
          pageParams,
        );
      }
      return definition;
    });
  }

  function FsRoutesApp({
    tree,
    metas,
    page,
  }: {
    tree: FsRouteTreeNode[];
    metas: Map<FsRouteTreeNode, NodeMeta>;
    page: StaticPage;
  }): ReactNode {
    const routes = buildRouteDefinitions(
      tree,
      metas,
      new Set(page.chain),
      page.params,
    );
    return createElement(Router, {
      routes,
      fallback: "static",
      ssr: { path: page.urlPath },
    });
  }

  return async function* getEntries(): AsyncGenerator<EntryDefinition> {
    const warn = (message: string) => {
      console.warn(`[funstack] ${message}`);
    };
    const files = modulesToRouteFiles(modules, base, warn);
    const tree = adapter.buildRoutes(files);
    validateRouteModules(tree);
    const pages = await collectStaticPaths(tree);
    const metas = new Map<FsRouteTreeNode, NodeMeta>();
    buildNodeMetas(tree, [], "", metas);
    registerChunks(pages, metas, host);
    for (const page of pages) {
      yield {
        path: urlPathToFilePath(page.urlPath),
        root: { default: Root },
        app: createElement(FsRoutesApp, { tree, metas, page }),
      };
    }
  };
}

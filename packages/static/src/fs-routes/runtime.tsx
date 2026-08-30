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
   * Whether the chunk registered under `id` is still available. In dev the
   * defer registry evicts entries over time, so a chunk registered by an
   * earlier request may be gone by the next one.
   */
  hasChunk(id: string): boolean;
  /**
   * Re-registers an evicted chunk under its original payload ID, so that
   * payloads already served to clients (whose `chunks` maps bake in that ID)
   * can still fetch it on soft navigation.
   */
  restoreChunk(element: ReactElement, id: string, name: string): void;
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
 * A registered chunk kept for re-registration: the dev defer registry may
 * evict the chunk while its payload ID is still baked into payloads held by
 * open tabs, and re-registering the same element under the same ID lets
 * those tabs keep soft-navigating.
 */
interface RegisteredChunk {
  element: ReactElement;
  name: string;
}

/**
 * Registers one pre-rendered RSC chunk per Server Component node per params
 * combination occurring among the generated pages, filling each node's
 * `chunks` map. Client-side soft navigation fetches these chunks to render
 * Server Component output for the destination's params.
 *
 * Returns the registered chunks by payload ID, for later restoration of
 * entries the dev registry has evicted.
 */
function registerChunks(
  pages: StaticPage[],
  metas: Map<FsRouteTreeNode, NodeMeta>,
  host: FsRoutesRuntimeHost,
): Map<string, RegisteredChunk> {
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
  const registered = new Map<string, RegisteredChunk>();
  for (const [node, nodeCombos] of combos) {
    const meta = metas.get(node)!;
    const Component = node.module.default!;
    for (const [key, params] of nodeCombos) {
      const element = createElement(Component, { params, route: meta.route });
      const name = `fs-route ${node.filePath ?? meta.id} ${key}`;
      const id = host.registerChunk(element, name);
      meta.chunks[key] = id;
      registered.set(id, { element, name });
    }
  }
  return registered;
}

/**
 * The result of enumerating the whole site once: the route tree, per-node
 * metadata, every statically-generated page, and the registered chunks.
 */
interface EnumeratedRoutes {
  tree: FsRouteTreeNode[];
  metas: Map<FsRouteTreeNode, NodeMeta>;
  pages: StaticPage[];
  chunks: Map<string, RegisteredChunk>;
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
 * The enumeration itself (route tree, `generateStaticParams()` of every
 * dynamic route, chunk registration) runs once and is cached for the
 * lifetime of the module instance, however many times `getEntries()` is
 * iterated — see the comment on `enumerated` below.
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

  async function enumerateRoutes(): Promise<EnumeratedRoutes> {
    const warn = (message: string) => {
      console.warn(`[funstack] ${message}`);
    };
    const files = modulesToRouteFiles(modules, base, warn);
    const tree = adapter.buildRoutes(files);
    validateRouteModules(tree);
    const pages = await collectStaticPaths(tree);
    const metas = new Map<FsRouteTreeNode, NodeMeta>();
    buildNodeMetas(tree, [], "", metas);
    const chunks = registerChunks(pages, metas, host);
    return { tree, metas, pages, chunks };
  }

  // The enumeration is cached for the lifetime of this module instance. The
  // dev server iterates getEntries() on every request; without the cache,
  // each request would re-run every generateStaticParams() and register a
  // fresh set of chunks under new IDs, flooding the dev defer registry
  // until chunk IDs held by other (or long-idle) tabs are evicted and their
  // soft navigation falls back to hard navigation. Editing a routed
  // file invalidates the entries module in dev, so a fresh module instance
  // re-enumerates; a build iterates getEntries() once, making the cache
  // inert there.
  let enumerated: Promise<EnumeratedRoutes> | undefined;

  return async function* getEntries(): AsyncGenerator<EntryDefinition> {
    if (enumerated === undefined) {
      const attempt = enumerateRoutes();
      // A failed enumeration (e.g. a transient error thrown by a
      // generateStaticParams() fetching data) is not cached, so the next
      // request retries instead of failing for the rest of the session.
      attempt.catch(() => {
        if (enumerated === attempt) {
          enumerated = undefined;
        }
      });
      enumerated = attempt;
    }
    const { tree, metas, pages, chunks } = await enumerated;
    // Re-register any chunk the dev registry evicted since enumeration,
    // under its original ID: payloads already served bake chunk IDs into
    // their slots, and restoring the ID keeps those pages soft-navigable.
    for (const [id, { element, name }] of chunks) {
      if (!host.hasChunk(id)) {
        host.restoreChunk(element, id, name);
      }
    }
    for (const page of pages) {
      yield {
        path: urlPathToFilePath(page.urlPath),
        root: { default: Root },
        app: createElement(FsRoutesApp, { tree, metas, page }),
      };
    }
  };
}

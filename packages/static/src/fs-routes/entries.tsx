import { FsRouteSlot } from "#rsc-client";
import { deferRegistry, registerDeferredPayload } from "../rsc/defer";
import type { GetEntriesResult } from "../entryDefinition";
import {
  createFsRoutesEntriesWithHost,
  type CreateFsRoutesOptions,
  type FsRoutesRuntimeHost,
} from "./runtime";

/**
 * The runtime host backed by the RSC environment: chunks are registered in
 * the shared defer registry (served on demand in dev, written as
 * content-hashed payload files at build), and Server Component route nodes
 * render through the `FsRouteSlot` client reference.
 */
const rscRuntimeHost: FsRoutesRuntimeHost = {
  registerChunk: registerDeferredPayload,
  hasChunk: (id) => deferRegistry.has(id),
  restoreChunk: (element, id, name) => {
    deferRegistry.register(element, id, name);
  },
  RouteSlot: FsRouteSlot,
};

/**
 * Builds FUNSTACK Router state for file-system routing and returns a
 * `getEntries` function (the default export expected by the `entries` plugin
 * option). One entry is produced per statically-generated page.
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
  return createFsRoutesEntriesWithHost(options, rscRuntimeHost);
}

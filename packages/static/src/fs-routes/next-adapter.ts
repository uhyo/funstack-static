/**
 * Convenience adapter module for the built-in Next.js-like file-system routing
 * convention, configured with default options.
 *
 * Point the `fsRoutes.adapter` plugin option at this module to use it without
 * writing your own adapter file:
 *
 * ```ts
 * funstackStatic({
 *   fsRoutes: {
 *     dir: "./src/pages",
 *     root: "./src/root.tsx",
 *     adapter: "@funstack/static/fs-routes/next-adapter",
 *   },
 * });
 * ```
 *
 * To customize the convention, call `nextRoutes(options)` from
 * `@funstack/static/fs-routes` in your own adapter module instead.
 *
 * @experimental File-system routing is experimental and not yet subject to
 * semantic versioning.
 *
 * @packageDocumentation
 */
import { nextRoutes } from "./nextAdapter";
import type { FsRoutesAdapter } from "./types";

const adapter: FsRoutesAdapter = nextRoutes();

export default adapter;

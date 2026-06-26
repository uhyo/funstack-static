/**
 * Built-in file-system routing for `@funstack/static`.
 *
 * @experimental This module is experimental and not yet subject to semantic
 * versioning. Its API may change in a minor release.
 *
 * @packageDocumentation
 */
export { nextRoutes, type NextRoutesOptions } from "./nextAdapter";
export type {
  FsRoutesAdapter,
  FsRouteFile,
  FsRouteModule,
  FsRouteTreeNode,
  FsRootComponent,
  MaybePromise,
} from "./types";
export { collectStaticPaths, urlPathToFilePath, type StaticPage } from "./tree";
export { createFsRoutesEntries, type CreateFsRoutesOptions } from "./runtime";

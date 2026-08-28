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
  FsRouteComponentProps,
  FsRouteFile,
  FsRouteModule,
  FsRouteObject,
  FsRouteTreeNode,
  FsRootComponent,
  MaybePromise,
} from "./types";
export { collectStaticPaths, urlPathToFilePath, type StaticPage } from "./tree";
export { createFsRoutesEntries } from "./entries";
export type { CreateFsRoutesOptions } from "./runtime";

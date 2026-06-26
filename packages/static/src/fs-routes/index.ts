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

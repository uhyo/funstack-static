import type { ReactNode } from "react";

export type MaybePromise<T> = T | Promise<T>;

export type RootModule = {
  default: React.ComponentType<{ children: React.ReactNode }>;
};

export type AppModule = { default: React.ComponentType };

export interface EntryDefinition {
  /**
   * Output file path relative to the build output directory.
   * Must end with ".html" or ".htm".
   * Examples:
   *   "index.html"
   *   "about.html"
   *   "about.htm"
   *   "blog/post-1.html"
   *   "blog/post-1/index.html"
   */
  path: string;
  /**
   * Root component module.
   * Can be a lazy import or a synchronous module object.
   * The module must have a `default` export of a React component.
   */
  root: MaybePromise<RootModule> | (() => MaybePromise<RootModule>);
  /**
   * App content for this entry.
   * Can be:
   * - A module (sync or lazy) with a `default` export component.
   * - A React node (JSX of a server component) for direct rendering.
   */
  app: ReactNode | MaybePromise<AppModule> | (() => MaybePromise<AppModule>);
}

/**
 * Return type of the getEntries function.
 */
export type GetEntriesResult =
  | Iterable<EntryDefinition>
  | AsyncIterable<EntryDefinition>;

declare module "virtual:funstack/entries" {
  import type { GetEntriesResult } from "./entryDefinition";
  const getEntries: () => GetEntriesResult;
  export default getEntries;
}
declare module "virtual:funstack/config" {
  export const ssr: boolean;
  /**
   * Effective SSR setting for the dev server. Equals `ssr` except for
   * file-system routing, which always server-renders in dev to avoid shipping
   * server components as eval'd dev-JSX references to the client (issue #124).
   */
  export const devSsr: boolean;
  export const rscPayloadDir: string;
}
declare module "virtual:funstack/client-init" {}
declare module "virtual:funstack/build-entry" {
  import type { BuildEntryFunction } from "./buildEntryDefinition";
  const buildEntry: BuildEntryFunction | undefined;
  export default buildEntry;
}

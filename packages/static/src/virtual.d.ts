declare module "virtual:funstack/entries" {
  import type { GetEntriesResult } from "./entryDefinition";
  const getEntries: () => GetEntriesResult;
  export default getEntries;
}
declare module "virtual:funstack/config" {
  export const ssr: boolean;
  export const rscPayloadDir: string;
}
declare module "virtual:funstack/client-init" {}
declare module "virtual:funstack/build-entry" {
  import type { BuildEntryFunction } from "./buildEntryDefinition";
  const buildEntry: BuildEntryFunction | undefined;
  export default buildEntry;
}

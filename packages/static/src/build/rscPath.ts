import { getModulePathFor, getPayloadIDFor } from "../rsc/rscModule";

/**
 * Placeholder used during SSR (will be replaced after hash is computed)
 */
export const rscPayloadPlaceholder = "__FUNSTACK_RSC_PAYLOAD_PATH__";

/**
 * Generate final path from content hash (reuses same folder as deferred payloads)
 */
export function getRscPayloadPath(contentHash: string): string {
  return getModulePathFor(getPayloadIDFor(contentHash));
}

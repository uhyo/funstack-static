import type { ReactNode } from "react";
import type { FsRouteObject } from "./types";

/**
 * Props of the internal client component (`FsRouteSlot` in `#rsc-client`)
 * that stands in for a Server Component page or layout in the route
 * definitions. All props are RSC-serializable so the slot can be baked into
 * each page's payload.
 *
 * The slot renders `initial` while the current match's params equal the
 * params this payload was built with, and otherwise fetches the pre-rendered
 * RSC chunk for the current params from `chunks`.
 */
export interface FsRouteSlotProps {
  /** Route object resolving to this route's context in the typed hooks. */
  route: FsRouteObject;
  /**
   * Names of the dynamic params consumed by segments at or above this
   * node, in tree order. The current match's params are restricted to
   * these names to identify the chunk to render.
   */
  paramNames: string[];
  /**
   * Pre-rendered RSC chunk payload IDs by params key (see
   * {@link paramsKey}), covering every params combination this node was
   * statically generated with.
   */
  chunks: Record<string, string>;
  /**
   * Params key this payload was built with. Present only when this node is
   * on the generated page's own route chain; other nodes always resolve
   * through `chunks` when navigated to.
   */
  initialKey?: string;
  /** Build-time rendered output for `initialKey`. */
  initial?: ReactNode;
}

/**
 * Serializes the params relevant to a route node into a stable string key.
 *
 * The key is the JSON array of the values of `paramNames`, in order — e.g.
 * `["en"]` for `paramNames: ["lang"]` and `params: { lang: "en" }`. JSON
 * escaping keeps values containing `/` (catch-all segments) or quotes
 * unambiguous. A node with no dynamic params has the key `[]`.
 */
export function paramsKey(
  paramNames: readonly string[],
  params: Record<string, string>,
): string {
  return JSON.stringify(paramNames.map((name) => params[name] ?? null));
}

/**
 * Restricts a params object to the given names (missing names are omitted).
 */
export function pickParams(
  params: Record<string, string>,
  paramNames: readonly string[],
): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const name of paramNames) {
    const value = params[name];
    if (value !== undefined) {
      picked[name] = value;
    }
  }
  return picked;
}

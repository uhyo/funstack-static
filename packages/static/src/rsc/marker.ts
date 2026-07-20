/**
 * Prefix of marker for App entry point.
 */
export const appMarkerPrefix = "__FUNSTACK_APP_ENTRY__";

/**
 * Generates an HTML ID for marking App entry point.
 */
export function generateAppMarker(): string {
  return `${appMarkerPrefix}${crypto.randomUUID()}`;
}

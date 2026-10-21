/**
 * Removes `<link rel="modulepreload">` tags from the HTML of a page without
 * client JavaScript.
 *
 * `@vitejs/plugin-rsc` preloads the chunks of every Client Component that
 * renders during SSR (via `ReactDOM.preloadModule`), on the assumption that
 * the client runtime will import them. A page with `clientScript: false`
 * never does, so the preloads would only make the browser download scripts
 * it never runs. The HTML is React's own output, in which attribute values
 * are escaped, so a `>` cannot occur inside the tag.
 */
export function stripModulePreloads(html: string): string {
  return html.replaceAll(/<link rel="modulepreload"[^>]*>/g, "");
}

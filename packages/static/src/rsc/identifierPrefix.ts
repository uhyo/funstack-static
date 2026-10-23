import { sanitizeName } from "./sanitizeName";

/**
 * `useId()` in a Server Component returns `_<prefix>S_<n>_`, where `<n>`
 * counts from zero in every Flight render (`renderToReadableStream` call)
 * and `<prefix>` is the render's `identifierPrefix` option. The main payload
 * of a page renders without a prefix, so every other Flight render whose
 * output ends up in the same document must use a prefix of its own, or its
 * ids collide with the main payload's (#198).
 *
 * All prefixes handed out here are distinct from one another and from the
 * empty prefix, and only contain characters that are safe in CSS selectors
 * (`[A-Za-z0-9_-]`, like React's own ids).
 */

/**
 * Identifier prefix of the Root shell render in SSR-off mode. The shell's
 * HTML stays in the document while the App payload (rendered separately,
 * without a prefix) is mounted inside it.
 */
export const shellIdentifierPrefix = "shell";

/**
 * Hands out identifier prefixes for deferred payloads.
 *
 * Prefixes are `<name>_<n>` for named payloads and `d<n>` for unnamed ones,
 * where `<n>` counts registrations with the same (sanitized) name. Counting
 * per name rather than globally keeps a payload's ids — and so the content
 * hash of its file in a build — unaffected by `defer()` calls with other
 * names being added or removed elsewhere in the app.
 */
export class DeferIdentifierPrefixes {
  #counters = new Map<string, number>();

  /**
   * Returns the prefix for the next deferred payload registered under
   * `name` (the raw name given to `defer()`, if any).
   */
  next(name: string | undefined): string {
    // An empty sanitized name is treated like no name, as in the payload ID.
    const key = name ? sanitizeName(name) : "";
    const ordinal = this.#counters.get(key) ?? 0;
    this.#counters.set(key, ordinal + 1);
    // `<name>_<n>` is unambiguous: `<n>` is the digits after the last
    // underscore, so two different (name, n) pairs never produce the same
    // string. `d<n>` contains no underscore and cannot clash with it, nor
    // with `shellIdentifierPrefix`.
    return key === "" ? `d${ordinal}` : `${key}_${ordinal}`;
  }
}

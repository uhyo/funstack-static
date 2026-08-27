const CLIENT_REFERENCE = Symbol.for("react.client.reference");

/**
 * Whether a module export is a client reference, meaning the module is marked
 * `"use client"`. React's `registerClientReference` tags every such export
 * with `$$typeof`.
 */
export function isClientReference(value: unknown): boolean {
  return (
    typeof value === "function" &&
    "$$typeof" in value &&
    value.$$typeof === CLIENT_REFERENCE
  );
}

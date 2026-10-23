/**
 * Sanitizes a `defer()` name for use in file paths and DOM ids.
 * Replaces non-alphanumeric characters with underscores and limits length.
 */
export function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50);
}

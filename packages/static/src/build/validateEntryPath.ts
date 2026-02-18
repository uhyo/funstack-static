/**
 * Validates an entry path string.
 * - Must end with ".html" or ".htm"
 * - Must not start with "/"
 *
 * @returns An error message if invalid, or undefined if valid.
 */
export function validateEntryPath(entryPath: string): string | undefined {
  if (entryPath.startsWith("/")) {
    return `Entry path must not start with "/": "${entryPath}". Paths are relative to the output directory.`;
  }
  if (!entryPath.endsWith(".html") && !entryPath.endsWith(".htm")) {
    return `Entry path must end with ".html" or ".htm": "${entryPath}"`;
  }
  return undefined;
}

/**
 * Checks an array of entry paths for duplicates.
 *
 * @returns An error message if duplicates found, or undefined if all unique.
 */
export function checkDuplicatePaths(paths: string[]): string | undefined {
  const seen = new Set<string>();
  for (const p of paths) {
    if (seen.has(p)) {
      return `Duplicate entry path: "${p}"`;
    }
    seen.add(p);
  }
  return undefined;
}

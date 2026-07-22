/**
 * Escapes characters that have special meaning in regular expressions.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces temporary IDs with final hashed IDs in content.
 *
 * All replacements happen in a single pass over the content using one
 * alternation regex, instead of one full-string scan per mapping entry.
 * Identity mappings (oldId === newId) are skipped.
 */
export function replaceIdsInContent(
  content: string,
  idMapping: Map<string, string>,
): string {
  let pattern = "";
  for (const [oldId, newId] of idMapping) {
    if (oldId !== newId) {
      pattern += (pattern === "" ? "" : "|") + escapeRegExp(oldId);
    }
  }
  if (pattern === "") {
    return content;
  }
  return content.replace(new RegExp(pattern, "g"), (match) =>
    idMapping.get(match)!,
  );
}

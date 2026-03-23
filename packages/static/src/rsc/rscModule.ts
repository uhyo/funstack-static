/**
 * Default directory name for RSC payload files.
 */
export const defaultRscPayloadDir = "fun__rsc-payload";

/**
 * Combines the RSC payload directory with a raw ID to form a
 * namespaced payload ID (e.g. "fun__rsc-payload/abc123").
 */
export function getPayloadIDFor(
  rawId: string,
  rscPayloadDir: string = defaultRscPayloadDir,
): string {
  return `${rscPayloadDir}/${rawId}`;
}

const rscModulePathPrefix = "/funstack__/";
const rscModulePathSuffix = ".txt";

export function getModulePathFor(id: string): string {
  return `${rscModulePathPrefix}${id}${rscModulePathSuffix}`;
}

export function extractIDFromModulePath(
  modulePath: string,
): string | undefined {
  if (
    !modulePath.startsWith(rscModulePathPrefix) ||
    !modulePath.endsWith(rscModulePathSuffix)
  ) {
    return undefined;
  }
  return modulePath.slice(
    rscModulePathPrefix.length,
    -rscModulePathSuffix.length,
  );
}

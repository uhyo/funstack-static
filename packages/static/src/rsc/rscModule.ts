/**
 * Default directory name for RSC payload files.
 */
export const defaultRscPayloadDir = "fun:rsc-payload";

/**
 * Add prefix to raw ID to form payload ID so that the ID is
 * distinguishable from other possible IDs.
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

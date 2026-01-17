const rscModulePathPrefix = "/.funstack/rsc/";

export function getModulePathFor(id: string): string {
  return `${rscModulePathPrefix}${id}`;
}

export function extractIDFromModulePath(
  modulePath: string,
): string | undefined {
  if (!modulePath.startsWith(rscModulePathPrefix)) {
    return undefined;
  }
  return modulePath.slice(rscModulePathPrefix.length);
}

import type { RunnableDevEnvironment } from "vite";

/**
 * Get the entry point module of the RSC environment.
 */
export async function getRSCEntryPoint(environment: RunnableDevEnvironment) {
  const rscInput = environment.config.build.rollupOptions?.input;
  const source =
    rscInput !== undefined &&
    typeof rscInput !== "string" &&
    !Array.isArray(rscInput)
      ? rscInput.index
      : undefined;
  if (source === undefined) {
    throw new Error("Cannot determine RSC entry point");
  }
  const resolved = await environment.pluginContainer.resolveId(source);
  if (!resolved) {
    throw new Error(`Cannot resolve RSC entry: ${source}`);
  }
  const rscEntry = await environment.runner.import<
    typeof import("../rsc/entry")
  >(resolved.id);
  return rscEntry;
}

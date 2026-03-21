import type { RunnableDevEnvironment } from "vite";

/**
 * Get the entry point module of the RSC environment.
 */
export async function getRSCEntryPoint(environment: RunnableDevEnvironment) {
  // Vite 8 renamed rollupOptions to rolldownOptions; support both for Vite 7 compat
  const buildConfig = environment.config.build;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vite 7 compat
  const rscInput = (
    buildConfig.rolldownOptions ?? (buildConfig as any).rollupOptions
  )?.input;
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

/**
 * Context passed to the build entry function.
 */
export interface BuildEntryContext {
  /**
   * Performs the default build flow (rendering entries and writing output files).
   * Call this to execute the standard build process.
   * You can run additional work before, after, or in parallel with this function.
   */
  build: () => Promise<void>;
  /**
   * Absolute path to the output directory where built files are written.
   * Use this to write additional files (e.g. sitemap.xml) alongside the build output.
   */
  outDir: string;
}

/**
 * The build entry module should default-export a function with this signature.
 */
export type BuildEntryFunction = (
  context: BuildEntryContext,
) => Promise<void> | void;

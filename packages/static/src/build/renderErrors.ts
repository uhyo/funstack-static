/**
 * An error reported by React (via `onError`) while rendering during a build.
 * React recovers from these by emitting an error row into the RSC payload or
 * a client-rendered Suspense boundary into the HTML, so the render itself
 * does not reject.
 */
export interface RenderError {
  /**
   * Human-readable description of what was being rendered
   * (e.g. `RSC payload of "index.html"`).
   */
  source: string;
  error: unknown;
}

/**
 * Logs a render error and records it in `errors`.
 */
export function reportRenderError(
  errors: RenderError[],
  source: string,
  error: unknown,
): void {
  console.error(`[funstack] Error while rendering ${source}:`, error);
  errors.push({ source, error });
}

/**
 * Creates an `onError` handler for React renderers that reports errors with
 * `reportRenderError`.
 */
export function createRenderErrorHandler(
  errors: RenderError[],
  source: string,
): (error: unknown) => void {
  return (error) => reportRenderError(errors, source, error);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Creates the error thrown to fail the build when render errors were
 * collected.
 */
export function createRenderErrorsError(errors: RenderError[]): Error {
  const lines = errors.map(
    ({ source, error }) => `  - ${source}: ${errorMessage(error)}`,
  );
  return new AggregateError(
    errors.map(({ error }) => error),
    `[funstack] ${errors.length} error(s) occurred while rendering during the build:\n` +
      lines.join("\n") +
      "\nA static build has no server to recover these pages at request time, " +
      "so the build was aborted. Set `failOnRenderError: false` to emit the " +
      "output anyway.",
  );
}

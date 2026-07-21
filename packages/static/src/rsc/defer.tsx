import type { ReactElement, ReactNode } from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/react/rsc";
import { DeferredComponent } from "#rsc-client";
import { DeferRegistry } from "./deferRegistry";
import { getPayloadIDFor } from "./rscModule";
import { rscPayloadDir } from "virtual:funstack/config";

export {
  DeferRegistry,
  devDeferEvictionOptions,
  type DeferEntry,
  type LoadedDeferEntry,
} from "./deferRegistry";

/**
 * Options for the defer function.
 */
export interface DeferOptions {
  /**
   * Optional name for debugging purposes.
   * In development: included in the RSC payload file name.
   * In production: logged when the payload file is emitted.
   */
  name?: string;
}

/**
 * Sanitizes a name for use in file paths.
 * Replaces non-alphanumeric characters with underscores and limits length.
 */
function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50);
}

export const deferRegistry = new DeferRegistry((element) =>
  renderToReadableStream<ReactNode>(element),
);

/**
 * Renders given Server Component into a separate RSC payload.
 *
 * During the client side rendering, fetching of the payload will be
 * deferred until the returned ReactNode is actually rendered.
 *
 * @param element - The React element to defer.
 * @param options - Optional configuration for the deferred payload.
 * @returns A ReactNode that virtually contains the result of rendering the given component.
 */
export function defer(
  element: ReactElement,
  options?: DeferOptions,
): ReactNode {
  const name = options?.name;
  const sanitizedName = name ? sanitizeName(name) : undefined;
  const rawId = sanitizedName
    ? `${sanitizedName}-${crypto.randomUUID()}`
    : crypto.randomUUID();
  const id = getPayloadIDFor(rawId, rscPayloadDir);
  deferRegistry.register(element, id, name);

  return <DeferredComponent moduleID={id} />;
}

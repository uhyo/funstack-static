import type { ReactElement, ReactNode } from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/react/rsc";
import { DeferredComponent } from "#rsc-client";
import { DeferRegistry } from "./deferRegistry";
import { DeferIdentifierPrefixes } from "./identifierPrefix";
import { getPayloadIDFor } from "./rscModule";
import { sanitizeName } from "./sanitizeName";
import { rscPayloadDir } from "virtual:funstack/config";

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

let deferRenderErrorHandler:
  ((error: unknown, name: string | undefined) => void) | undefined;

/**
 * Sets the handler for errors reported while rendering deferred payloads.
 * Used by the build to collect render errors; when unset, React's default
 * (`console.error`) applies.
 */
export function setDeferRenderErrorHandler(
  handler: ((error: unknown, name: string | undefined) => void) | undefined,
) {
  deferRenderErrorHandler = handler;
}

export const deferRegistry = new DeferRegistry(
  (element, { name, identifierPrefix }) => {
    const handler = deferRenderErrorHandler;
    return renderToReadableStream<ReactNode>(element, {
      // Each deferred payload is a Flight render of its own, so without a
      // prefix its `useId()` ids would repeat those of the main payload and
      // of other deferred payloads on the same page (#198).
      identifierPrefix,
      onError: handler && ((error: unknown) => handler(error, name)),
    });
  },
);

const identifierPrefixes = new DeferIdentifierPrefixes();

/**
 * Registers a Server Component element as a separate RSC payload in the
 * shared defer registry and returns the payload ID under which it is served.
 * The sanitized `name` is included in the dev payload file name for
 * debugging.
 */
export function registerDeferredPayload(
  element: ReactElement,
  name?: string,
): string {
  const sanitizedName = name ? sanitizeName(name) : undefined;
  const rawId = sanitizedName
    ? `${sanitizedName}-${crypto.randomUUID()}`
    : crypto.randomUUID();
  const id = getPayloadIDFor(rawId, rscPayloadDir);
  restoreDeferredPayload(element, id, name);
  return id;
}

/**
 * Registers a Server Component element in the shared defer registry under
 * an already-known payload ID (used to re-register entries the dev registry
 * has evicted). The entry receives a fresh identifier prefix.
 */
export function restoreDeferredPayload(
  element: ReactElement,
  id: string,
  name?: string,
): void {
  deferRegistry.register(element, id, name, identifierPrefixes.next(name));
}

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
  const id = registerDeferredPayload(element, options?.name);
  return <DeferredComponent moduleID={id} />;
}

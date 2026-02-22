import type { ReactElement, ReactNode } from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/react/rsc";
import { DeferredComponent } from "#rsc-client";
import { drainStream } from "../util/drainStream";
import { getPayloadIDFor } from "./rscModule";

export interface DeferEntry {
  state: DeferEntryState;
  name?: string;
  drainPromise?: Promise<string>;
}

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

export interface LoadedDeferEntry extends DeferEntry {
  state: Exclude<DeferEntryState, { state: "pending" }>;
  drainPromise: Promise<string>;
}

type DeferEntryState =
  | {
      state: "pending";
      element: ReactElement;
    }
  | {
      state: "streaming";
      stream: ReadableStream<Uint8Array>;
    }
  | {
      state: "ready";
    }
  | {
      state: "error";
      error: unknown;
    };

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

export class DeferRegistry {
  #registry = new Map<string, DeferEntry>();

  register(element: ReactElement, id: string, name?: string) {
    this.#registry.set(id, { state: { element, state: "pending" }, name });
  }

  load(id: string): LoadedDeferEntry | undefined {
    const entry = this.#registry.get(id);
    if (!entry) {
      return undefined;
    }
    return this.#loadEntry(entry);
  }

  #loadEntry(entry: DeferEntry): LoadedDeferEntry {
    const { state } = entry;
    switch (state.state) {
      case "pending": {
        const stream = renderToReadableStream<ReactNode>(state.element);
        const [stream1, stream2] = stream.tee();
        entry.state = { state: "streaming", stream: stream1 };
        const drainPromise = drainStream(stream2);
        entry.drainPromise = drainPromise;
        drainPromise.then(
          () => {
            entry.state = { state: "ready" };
          },
          (error) => {
            entry.state = { state: "error", error };
          },
        );
        return entry as LoadedDeferEntry;
      }
      case "streaming":
      case "ready":
      case "error":
        return entry as LoadedDeferEntry;
    }
  }

  has(id: string): boolean {
    return this.#registry.has(id);
  }

  /**
   * Iterates over all entries in parallel.
   * Yields results as each stream completes.
   */
  async *loadAll() {
    const errors: unknown[] = [];

    // Phase 1: Start all entries loading and collect drain promises.
    // We use drain promises (which drain stream2 from tee) instead of
    // draining stream1 directly, because stream1 may have been locked
    // by createFromReadableStream during SSR.
    const loadedEntries = Array.from(this.#registry, ([id, entry]) => {
      const loaded = this.#loadEntry(entry);
      return [id, loaded.drainPromise, entry.name] as const;
    });

    if (loadedEntries.length === 0) return;

    type Result = { id: string; data: string; name?: string };

    // Completion queue
    const completed: Array<Result | { error: unknown }> = [];
    let waiting: (() => void) | undefined;
    let remainingCount = loadedEntries.length;

    const onComplete = (result: Result | { error: unknown }) => {
      completed.push(result);
      remainingCount--;
      waiting?.();
    };

    // Phase 2: Await drain promises
    for (const [id, drainPromise, name] of loadedEntries) {
      drainPromise.then(
        (data) => onComplete({ id, data, name }),
        (error) => onComplete({ error }),
      );
    }

    // Phase 3: Yield from queue as results arrive
    while (remainingCount > 0 || completed.length > 0) {
      if (completed.length === 0) {
        await new Promise<void>((r) => {
          waiting = r;
        });
        waiting = undefined;
      }
      for (const result of completed.splice(0)) {
        if ("error" in result) {
          errors.push(result.error);
        } else {
          yield result;
        }
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors);
    }
  }
}

export const deferRegistry = new DeferRegistry();

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
  const id = getPayloadIDFor(rawId);
  deferRegistry.register(element, id, name);

  return <DeferredComponent moduleID={id} />;
}

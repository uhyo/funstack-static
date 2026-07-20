import type { ReactElement } from "react";
import { drainStream } from "../util/drainStream";

export interface DeferEntry {
  state: DeferEntryState;
  name?: string;
  drainPromise?: Promise<string>;
  /**
   * Timestamp (ms) of the last registration or load of this entry.
   * Used by `evictStale` to drop entries no longer reachable by any client.
   */
  lastAccessedAt: number;
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
 * Renders a React element to an RSC payload stream.
 * Injected so the registry does not depend on the RSC runtime directly.
 */
export type RenderToStream = (
  element: ReactElement,
) => ReadableStream<Uint8Array>;

/**
 * How long a defer entry is kept in the dev registry after it was last
 * registered or loaded. Each dev render registers fresh entries (with new
 * IDs), so old entries become unreachable once the client re-renders;
 * without eviction the registry grows unboundedly over a dev session.
 * The TTL leaves a generous window for lazily-rendered DeferredComponents
 * to fetch their payload after the page loaded.
 */
export const devDeferEntryTTL = 5 * 60 * 1000;

export class DeferRegistry {
  #registry = new Map<string, DeferEntry>();
  #render: RenderToStream;

  constructor(render: RenderToStream) {
    this.#render = render;
  }

  register(element: ReactElement, id: string, name?: string) {
    this.#registry.set(id, {
      state: { element, state: "pending" },
      name,
      lastAccessedAt: Date.now(),
    });
  }

  load(id: string): LoadedDeferEntry | undefined {
    const entry = this.#registry.get(id);
    if (!entry) {
      return undefined;
    }
    entry.lastAccessedAt = Date.now();
    return this.#loadEntry(entry);
  }

  #loadEntry(entry: DeferEntry): LoadedDeferEntry {
    const { state } = entry;
    switch (state.state) {
      case "pending": {
        const stream = this.#render(state.element);
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
   * Drops entries that have not been registered or loaded within the given
   * TTL. Called from dev server request handlers to keep the registry from
   * growing unboundedly across renders; never called during a build.
   *
   * Evicting an entry does not cancel an in-flight render: responses
   * already holding the entry's stream or drain promise are unaffected.
   */
  evictStale(ttlMs: number): void {
    const now = Date.now();
    for (const [id, entry] of this.#registry) {
      if (now - entry.lastAccessedAt > ttlMs) {
        this.#registry.delete(id);
      }
    }
  }

  /**
   * Iterates over all entries in parallel.
   * Yields results as each stream completes.
   *
   * Rendering a deferred element may itself call `defer()` (nested defer),
   * registering new entries while earlier ones are still draining. Entries
   * registered mid-iteration are picked up too, until none are left.
   */
  async *loadAll() {
    const errors: unknown[] = [];

    type Result = { id: string; data: string; name?: string };

    // Completion queue
    const completed: Array<Result | { error: unknown }> = [];
    let waiting: (() => void) | undefined;
    let remainingCount = 0;
    const started = new Set<string>();

    // Start loading every entry not started yet and track its drain promise.
    // We use drain promises (which drain stream2 from tee) instead of
    // draining stream1 directly, because stream1 may have been locked
    // by createFromReadableStream during SSR.
    const startPending = () => {
      for (const [id, entry] of this.#registry) {
        if (started.has(id)) continue;
        started.add(id);
        const loaded = this.#loadEntry(entry);
        remainingCount++;
        loaded.drainPromise.then(
          (data) => {
            completed.push({ id, data, name: entry.name });
            remainingCount--;
            waiting?.();
          },
          (error) => {
            completed.push({ error });
            remainingCount--;
            waiting?.();
          },
        );
      }
    };

    startPending();

    // Yield from queue as results arrive
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
      // A drained entry may have registered nested entries during its
      // render; any registration happens before its parent's drain promise
      // resolves, so once remainingCount hits 0 no new entries can appear.
      startPending();
    }

    if (errors.length > 0) {
      throw new AggregateError(errors);
    }
  }
}

import type { ReactElement, ReactNode } from "react";
import { AsyncLocalStorage } from "node:async_hooks";
import { renderToReadableStream } from "@vitejs/plugin-rsc/react/rsc";
import { drainStream } from "../util/drainStream";

export interface DeferEntry {
  state: DeferEntryState;
  name?: string;
  drainPromise?: Promise<string>;
  /**
   * The top-level render this entry belongs to.
   * Only set in dev, where renders are scoped via `startRender`.
   */
  render?: RenderHandle;
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
 * Represents one top-level HTML render in the dev server.
 *
 * Every `defer()` registration made while rendering a page — including
 * nested `defer()` calls made when a deferred element itself is rendered
 * later — is attributed to the same RenderHandle, forming a "rendered-by"
 * tree rooted at the top-level render. When a new top-level render for the
 * same key begins, the previous render's whole tree is evicted after a
 * grace period, so the registry does not grow unboundedly over a dev
 * session (see issue #144).
 */
export interface RenderHandle {
  /** Identifies what is being rendered (the entry path in dev). */
  readonly key: string;
  /** IDs of all entries registered during this render, incl. nested ones. */
  readonly ids: Set<string>;
  /** True once this render has been superseded by a newer one. */
  invalidated: boolean;
}

/**
 * How long entries of a superseded render are kept before eviction.
 * The grace period lets in-flight client fetches for the previous
 * page load still resolve.
 */
export const renderEvictionGracePeriodMs = 30_000;

export class DeferRegistry {
  #registry = new Map<string, DeferEntry>();
  #renderContext = new AsyncLocalStorage<RenderHandle>();
  #currentRenders = new Map<string, RenderHandle>();

  /**
   * Marks the start of a new top-level render identified by `key` and runs
   * `fn` so that all `defer()` registrations made during it are attributed
   * to this render. Attribution propagates through async continuations, so
   * registrations made while React renders the tree started inside `fn`
   * are captured too.
   *
   * If a previous render exists for the same key, it is invalidated and
   * its entries (the whole rendered-by tree) are evicted after a grace
   * period.
   *
   * Only the dev server scopes renders; build-time rendering never calls
   * this, so build entries are kept until the process exits.
   */
  startRender<T>(key: string, fn: () => T): T {
    const previous = this.#currentRenders.get(key);
    if (previous) {
      previous.invalidated = true;
      this.#scheduleEviction(previous);
    }
    const handle: RenderHandle = { key, ids: new Set(), invalidated: false };
    this.#currentRenders.set(key, handle);
    return this.#renderContext.run(handle, fn);
  }

  #scheduleEviction(handle: RenderHandle) {
    const timer = setTimeout(() => {
      for (const id of handle.ids) {
        const entry = this.#registry.get(id);
        if (entry?.render === handle) {
          this.#registry.delete(id);
        }
      }
      handle.ids.clear();
    }, renderEvictionGracePeriodMs);
    // In Node, don't keep the process alive just for eviction.
    (timer as unknown as { unref?: () => void }).unref?.();
  }

  register(element: ReactElement, id: string, name?: string) {
    const render = this.#renderContext.getStore();
    this.#registry.set(id, {
      state: { element, state: "pending" },
      name,
      render,
    });
    if (render) {
      render.ids.add(id);
      if (render.invalidated) {
        // Late registration from an already-superseded render (e.g. the
        // previous render is still streaming, or a nested defer loads
        // after invalidation). Its eviction timer may have already fired,
        // so re-arm eviction to make sure this straggler is dropped too.
        this.#scheduleEviction(render);
      }
    }
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
        // Render within the owning render's context so that nested
        // `defer()` registrations attach to the same top-level render.
        const doRender = () => renderToReadableStream<ReactNode>(state.element);
        const stream = entry.render
          ? this.#renderContext.run(entry.render, doRender)
          : doRender();
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

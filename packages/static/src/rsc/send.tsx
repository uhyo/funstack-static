import type { FC } from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/react/rsc";
import { ClientWrapper } from "../entries/rsc-client";
import { drainStream } from "../util/drainStream";

export interface SendEntry {
  state: SendEntryState;
}

export interface LoadedSendEntry extends SendEntry {
  state: Exclude<SendEntryState, { state: "pending" }>;
}

type SendEntryState =
  | {
      state: "pending";
      component: FC<{}>;
    }
  | {
      state: "streaming";
      stream: ReadableStream<Uint8Array>;
    }
  | {
      state: "ready";
      data: string;
    }
  | {
      state: "error";
      error: unknown;
    };

export class SendRegistry {
  #registry = new Map<string, SendEntry>();
  #finalization = new FinalizationRegistry((id: string) => {
    this.#registry.delete(id);
  });

  register(component: FC<{}>, id: string) {
    this.#registry.set(id, { state: { component, state: "pending" } });
    this.#finalization.register(component, id);
  }

  load(id: string): LoadedSendEntry | undefined {
    const entry = this.#registry.get(id);
    if (!entry) {
      return undefined;
    }
    return this.#loadEntry(entry);
  }

  #loadEntry(entry: SendEntry): LoadedSendEntry {
    const { state } = entry;
    switch (state.state) {
      case "pending": {
        const stream = renderToReadableStream<React.ReactNode>(
          <state.component />,
        );
        const [stream1, stream2] = stream.tee();
        entry.state = { state: "streaming", stream: stream1 };
        (async () => {
          const chunks: string[] = [];
          const decoder = new TextDecoder();
          for await (const chunk of stream2) {
            chunks.push(decoder.decode(chunk, { stream: true }));
          }
          chunks.push(decoder.decode());
          entry.state = {
            state: "ready",
            data: chunks.join(""),
          };
        })().catch((error) => {
          entry.state = { state: "error", error };
        });
        return entry as LoadedSendEntry;
      }
      case "streaming":
      case "ready":
      case "error": {
        return entry as LoadedSendEntry;
      }
    }
    state satisfies never;
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

    // Phase 1: Start all entries loading
    const loadedEntries = Array.from(
      this.#registry,
      ([id, entry]) => [id, this.#loadEntry(entry)] as const,
    );

    if (loadedEntries.length === 0) return;

    type Result = { id: string; data: string };

    // Completion queue
    const completed: Array<Result | { error: unknown }> = [];
    let waiting: (() => void) | undefined;
    let remainingCount = loadedEntries.length;

    const onComplete = (result: Result | { error: unknown }) => {
      completed.push(result);
      remainingCount--;
      waiting?.();
    };

    // Phase 2: Start all operations (each pushes to queue when done)
    for (const [id, loadedEntry] of loadedEntries) {
      (async () => {
        try {
          switch (loadedEntry.state.state) {
            case "streaming":
              onComplete({
                id,
                data: await drainStream(loadedEntry.state.stream),
              });
              break;
            case "ready":
              onComplete({ id, data: loadedEntry.state.data });
              break;
            case "error":
              onComplete({ error: loadedEntry.state.error });
              break;
          }
        } catch (error) {
          onComplete({ error });
        }
      })();
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

export const sendRegistry = new SendRegistry();

const referenceIDMap = new WeakMap<FC<{}>, string>();

export function send(component: FC<{}>): React.ReactNode {
  let id = referenceIDMap.get(component);
  if (id === undefined) {
    id = crypto.randomUUID();
  }
  referenceIDMap.set(component, id);
  sendRegistry.register(component, id);

  return <ClientWrapper moduleID={id} />;
}

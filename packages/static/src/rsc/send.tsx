import type { FC } from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/react/rsc";
import { ClientWrapper } from "@funstack/static/entries/rsc-client";
import type { RscPayload } from "./entry";

export interface SendEntry {
  component: FC<{}>;
  state: SendEntryState;
}

export interface LoadedSendEntry extends SendEntry {
  state: Exclude<SendEntryState, { state: "pending" }>;
}

type SendEntryState =
  | {
      state: "pending";
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

  register(component: FC<{}>, id: string) {
    this.#registry.set(id, { component, state: { state: "pending" } });
  }

  load(id: string): LoadedSendEntry | undefined {
    const entry = this.#registry.get(id);
    if (!entry) {
      return undefined;
    }
    const { state, component: Component } = entry;
    switch (state.state) {
      case "pending": {
        const stream = renderToReadableStream<RscPayload>({
          root: <Component />,
        });
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

import React from "react";
import {
  createFromFetch,
  createFromReadableStream,
} from "@vitejs/plugin-rsc/browser";
import { getModulePathFor } from "../rsc/rscModule";
import { createContext, use } from "react";
import type { LoadedDeferEntry, DeferRegistry } from "../rsc/defer";
import { withBasePath } from "../util/basePath";

export const RegistryContext = createContext<DeferRegistry | undefined>(
  undefined,
);

interface ClientWrapperProps {
  moduleID: string;
}

export const ClientWrapper: React.FC<ClientWrapperProps> = ({ moduleID }) => {
  const registry = use(RegistryContext);
  const modulePath = getModulePathFor(moduleID);
  if (registry) {
    const entry = registry.load(moduleID);
    if (!entry) {
      throw new Error(`Module entry not found for ID '${moduleID}'`);
    }
    return getRSCStreamFromRegistry(entry);
  }
  const stream = getClientRSCStream(withBasePath(modulePath));
  return use(stream);
};

const moduleToStreamMap = new Map<string, Promise<React.ReactNode>>();

async function getRSCStreamFromRegistry(
  entry: LoadedDeferEntry,
): Promise<React.ReactNode> {
  switch (entry.state.state) {
    case "streaming": {
      return createFromReadableStream<React.ReactNode>(entry.state.stream);
    }
    case "ready": {
      const { readable, writable } = new TransformStream<
        Uint8Array,
        Uint8Array
      >();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(entry.state.data));
      await writer.close();
      return createFromReadableStream<React.ReactNode>(readable);
    }
    case "error": {
      return Promise.reject(entry.state.error);
    }
  }
}

function getClientRSCStream(modulePath: string) {
  let stream = moduleToStreamMap.get(modulePath);
  if (!stream) {
    stream = createFromFetch<React.ReactNode>(fetch(modulePath));
    moduleToStreamMap.set(modulePath, stream);
  }
  return stream;
}

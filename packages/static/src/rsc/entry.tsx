import "./defer";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import { devMainRscPath } from "./request";
import { generateAppMarker } from "./marker";
import { deferRegistry } from "./defer";
import { extractIDFromModulePath } from "./rscModule";
import { stripBasePath } from "../util/basePath";
import { urlPathToFileCandidates } from "../util/urlPath";
import { resolveRoot, resolveApp } from "./resolveEntry";
import type { EntryDefinition, GetEntriesResult } from "../entryDefinition";

export type RscPayload = {
  root: React.ReactNode;
};

export type EntryBuildResult = {
  path: string;
  html: ReadableStream<Uint8Array>;
  appRsc: ReadableStream<Uint8Array>;
};

import { ssr as ssrEnabled } from "virtual:funstack/config";

async function loadEntriesList(): Promise<EntryDefinition[]> {
  const getEntries = (await import("virtual:funstack/entries")).default;
  const result: GetEntriesResult = getEntries();
  const entries: EntryDefinition[] = [];
  for await (const entry of result) {
    entries.push(entry);
  }
  return entries;
}

/**
 * Find the entry matching a URL path from a list of entries.
 */
function findEntryForUrlPath(
  entries: EntryDefinition[],
  urlPath: string,
): EntryDefinition | undefined {
  const candidates = urlPathToFileCandidates(urlPath);
  for (const candidate of candidates) {
    const entry = entries.find((e) => e.path === candidate);
    if (entry) {
      return entry;
    }
  }
  return undefined;
}

/**
 * Renders a single entry to an HTML response.
 */
async function renderEntryToResponse(
  entry: EntryDefinition,
  timings: string[],
): Promise<Response> {
  const marker = generateAppMarker();

  const resolveStart = performance.now();
  const Root = await resolveRoot(entry.root);
  const appNode = await resolveApp(entry.app);
  timings.push(`resolve;dur=${performance.now() - resolveStart}`);

  const ssrModuleStart = performance.now();
  const ssrEntryModule = await import.meta.viteRsc.loadModule<
    typeof import("../ssr/entry")
  >("ssr");
  timings.push(`ssr-module;dur=${performance.now() - ssrModuleStart}`);

  if (ssrEnabled) {
    // SSR on: single RSC stream with full tree
    const rscStart = performance.now();
    const rootRscStream = renderToReadableStream<RscPayload>({
      root: <Root>{appNode}</Root>,
    });
    timings.push(`rsc;dur=${performance.now() - rscStart}`);

    const ssrStart = performance.now();
    const ssrResult = await ssrEntryModule.renderHTML(rootRscStream, {
      appEntryMarker: marker,
      build: false,
      ssr: true,
      deferRegistry,
    });
    timings.push(`ssr;dur=${performance.now() - ssrStart}`);

    return new Response(ssrResult.stream, {
      status: ssrResult.status,
      headers: {
        "Content-type": "text/html",
        "Server-Timing": timings.join(", "),
      },
    });
  } else {
    // SSR off: shell RSC for SSR, full RSC for client
    const rscStart = performance.now();
    const shellRscStream = renderToReadableStream<RscPayload>({
      root: (
        <Root>
          <span id={marker} />
        </Root>
      ),
    });
    const clientRscStream = renderToReadableStream<RscPayload>({
      root: <Root>{appNode}</Root>,
    });
    timings.push(`rsc;dur=${performance.now() - rscStart}`);

    const ssrStart = performance.now();
    const ssrResult = await ssrEntryModule.renderHTML(shellRscStream, {
      appEntryMarker: marker,
      build: false,
      ssr: false,
      clientRscStream,
    });
    timings.push(`ssr;dur=${performance.now() - ssrStart}`);

    return new Response(ssrResult.stream, {
      status: ssrResult.status,
      headers: {
        "Content-type": "text/html",
        "Server-Timing": timings.join(", "),
      },
    });
  }
}

/**
 * Entrypoint to serve HTML response in dev environment.
 * Accepts a Request to determine which entry to render based on URL path.
 */
export async function serveHTML(request: Request): Promise<Response> {
  const timings: string[] = [];

  const entriesStart = performance.now();
  const entries = await loadEntriesList();
  timings.push(`entries;dur=${performance.now() - entriesStart}`);

  const url = new URL(request.url);
  const urlPath = stripBasePath(url.pathname);
  let entry = findEntryForUrlPath(entries, urlPath);

  // SPA fallback: if no entry matched, fall back to index.html or index.htm entry
  if (!entry) {
    entry = entries.find(
      (e) => e.path === "index.html" || e.path === "index.htm",
    );
  }

  if (!entry) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-type": "text/plain" },
    });
  }

  return renderEntryToResponse(entry, timings);
}

class ServeRSCError extends Error {
  status: 404 | 500;
  constructor(message: string, status: 404 | 500) {
    super(message);
    this.name = "ServeRSCError";
    this.status = status;
  }
}

export function isServeRSCError(error: unknown): error is ServeRSCError {
  return error instanceof Error && error.name === "ServeRSCError";
}

/**
 * Serves an RSC stream response
 */
export async function serveRSC(request: Request): Promise<Response> {
  const timings: string[] = [];
  const url = new URL(request.url);
  const pathname = stripBasePath(url.pathname);
  if (pathname === devMainRscPath) {
    // root RSC stream is requested (HMR re-fetch always sends full tree)
    // For HMR, re-render the first entry (single-entry mode) or index.html entry
    const entriesStart = performance.now();
    const entries = await loadEntriesList();
    timings.push(`entries;dur=${performance.now() - entriesStart}`);

    // Use the first entry for HMR re-fetch
    const entry = entries[0];
    if (!entry) {
      throw new ServeRSCError("No entries defined", 404);
    }

    const resolveStart = performance.now();
    const Root = await resolveRoot(entry.root);
    const appNode = await resolveApp(entry.app);
    timings.push(`resolve;dur=${performance.now() - resolveStart}`);

    const rscStart = performance.now();
    const rootRscStream = renderToReadableStream<RscPayload>({
      root: <Root>{appNode}</Root>,
    });
    timings.push(`rsc;dur=${performance.now() - rscStart}`);

    return new Response(rootRscStream, {
      status: 200,
      headers: {
        "content-type": "text/x-component;charset=utf-8",
        "Server-Timing": timings.join(", "),
      },
    });
  }

  const moduleId = extractIDFromModulePath(pathname);
  if (!moduleId) {
    throw new ServeRSCError(`Invalid RSC module path: ${pathname}`, 404);
  }

  const deferLoadStart = performance.now();
  const entry = deferRegistry.load(moduleId);
  if (!entry) {
    throw new ServeRSCError(`RSC component not found: ${moduleId}`, 404);
  }
  timings.push(`defer-load;dur=${performance.now() - deferLoadStart}`);

  const { state } = entry;
  switch (state.state) {
    case "streaming": {
      return new Response(state.stream, {
        status: 200,
        headers: {
          "content-type": "text/x-component;charset=utf-8",
          "Server-Timing": timings.join(", "),
        },
      });
    }
    case "ready": {
      return new Response(await entry.drainPromise, {
        status: 200,
        headers: {
          "content-type": "text/x-component;charset=utf-8",
          "Server-Timing": timings.join(", "),
        },
      });
    }
    case "error": {
      throw new ServeRSCError(
        `Failed to load RSC component: ${state.error}`,
        500,
      );
    }
  }
}

/**
 * Build handler — iterates over all entries and returns per-entry results
 * along with the shared defer registry.
 */
export async function build() {
  const getEntries = (await import("virtual:funstack/entries")).default;

  const ssrEntryModule = await import.meta.viteRsc.loadModule<
    typeof import("../ssr/entry")
  >("ssr");

  const results: EntryBuildResult[] = [];
  for await (const entry of getEntries()) {
    const Root = await resolveRoot(entry.root);
    const appNode = await resolveApp(entry.app);

    const marker = generateAppMarker();

    let rootRscStream: ReadableStream<Uint8Array>;
    let appRscStream: ReadableStream<Uint8Array>;

    if (ssrEnabled) {
      // SSR on: both streams have full tree
      rootRscStream = renderToReadableStream<RscPayload>({
        root: <Root>{appNode}</Root>,
      });
      appRscStream = renderToReadableStream<RscPayload>({
        root: <Root>{appNode}</Root>,
      });
    } else {
      // SSR off: root stream has shell, app stream has App only
      rootRscStream = renderToReadableStream<RscPayload>({
        root: (
          <Root>
            <span id={marker} />
          </Root>
        ),
      });
      appRscStream = renderToReadableStream<RscPayload>({
        root: appNode,
      });
    }

    const ssrResult = await ssrEntryModule.renderHTML(rootRscStream, {
      appEntryMarker: marker,
      build: true,
      ssr: ssrEnabled,
      deferRegistry,
    });

    results.push({
      path: entry.path,
      html: ssrResult.stream,
      appRsc: appRscStream,
    });
  }

  return {
    entries: results,
    deferRegistry,
  };
}

export { defer } from "./defer";

if (import.meta.hot) {
  import.meta.hot.accept();
}

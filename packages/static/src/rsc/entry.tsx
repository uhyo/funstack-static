import "./defer";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import { devMainRscPath } from "./request";
import { generateAppMarker } from "./marker";
import { deferRegistry } from "./defer";
import { extractIDFromModulePath } from "./rscModule";
import { stripBasePath } from "../util/basePath";

export type RscPayload = {
  root: React.ReactNode;
};

import { ssr as ssrEnabled } from "virtual:funstack/config";

async function loadEntries() {
  const Root = (await import("virtual:funstack/root")).default;
  const App = (await import("virtual:funstack/app")).default;

  // Sanity check; this may happen when user-provided entry file
  // does not have a default export.
  if (Root === undefined) {
    throw new Error(
      "Failed to load RSC root entry module. Check your entry file to ensure it has a default export.",
    );
  }
  if (App === undefined) {
    throw new Error(
      "Failed to load RSC app entry module. Check your entry file to ensure it has a default export.",
    );
  }
  return { Root, App };
}

/**
 * Entrypoint to serve HTML response in dev environment
 */
export async function serveHTML(): Promise<Response> {
  const timings: string[] = [];
  const marker = generateAppMarker();

  const entriesStart = performance.now();
  const { Root, App } = await loadEntries();
  timings.push(`entries;dur=${performance.now() - entriesStart}`);

  const ssrModuleStart = performance.now();
  const ssrEntryModule = await import.meta.viteRsc.loadModule<
    typeof import("../ssr/entry")
  >("ssr");
  timings.push(`ssr-module;dur=${performance.now() - ssrModuleStart}`);

  if (ssrEnabled) {
    // SSR on: single RSC stream with full tree
    const rscStart = performance.now();
    const rootRscStream = renderToReadableStream<RscPayload>({
      root: (
        <Root>
          <App />
        </Root>
      ),
    });
    timings.push(`rsc;dur=${performance.now() - rscStart}`);

    const ssrStart = performance.now();
    const ssrResult = await ssrEntryModule.renderHTML(rootRscStream, {
      appEntryMarker: marker,
      build: false,
      ssr: true,
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
      root: (
        <Root>
          <App />
        </Root>
      ),
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
 * Servers an RSC stream response
 */
export async function serveRSC(request: Request): Promise<Response> {
  const timings: string[] = [];
  const url = new URL(request.url);
  const pathname = stripBasePath(url.pathname);
  if (pathname === devMainRscPath) {
    // root RSC stream is requested (HMR re-fetch always sends full tree)
    const entriesStart = performance.now();
    const { Root, App } = await loadEntries();
    timings.push(`entries;dur=${performance.now() - entriesStart}`);

    const rscStart = performance.now();
    const rootRscStream = renderToReadableStream<RscPayload>({
      root: (
        <Root>
          <App />
        </Root>
      ),
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
      return new Response(state.data, {
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
 * Build handler
 */
export async function build() {
  const marker = generateAppMarker();
  const { Root, App } = await loadEntries();

  let rootRscStream: ReadableStream<Uint8Array>;
  let appRscStream: ReadableStream<Uint8Array>;

  if (ssrEnabled) {
    // SSR on: both streams have full tree
    rootRscStream = renderToReadableStream<RscPayload>({
      root: (
        <Root>
          <App />
        </Root>
      ),
    });
    appRscStream = renderToReadableStream<RscPayload>({
      root: (
        <Root>
          <App />
        </Root>
      ),
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
      root: <App />,
    });
  }

  const ssrEntryModule = await import.meta.viteRsc.loadModule<
    typeof import("../ssr/entry")
  >("ssr");

  const ssrResult = await ssrEntryModule.renderHTML(rootRscStream, {
    appEntryMarker: marker,
    build: true,
    ssr: ssrEnabled,
  });

  return {
    html: ssrResult.stream,
    appRsc: appRscStream,
    deferRegistry,
  };
}

export { defer } from "./defer";

if (import.meta.hot) {
  import.meta.hot.accept();
}

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

async function devMainRSCStream() {
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

  const rootRscStream = renderToReadableStream<RscPayload>({
    root: (
      <Root>
        <App />
      </Root>
    ),
  });
  return rootRscStream;
}

/**
 * Entrypoint to serve HTML response in dev environment
 */
export async function serveHTML(): Promise<Response> {
  const marker = generateAppMarker();

  const rootRscStream = await devMainRSCStream();

  const ssrEntryModule = await import.meta.viteRsc.loadModule<
    typeof import("../ssr/entry")
  >("ssr");
  const ssrResult = await ssrEntryModule.renderHTML(rootRscStream, {
    appEntryMarker: marker,
    build: false,
  });

  // respond html
  return new Response(ssrResult.stream, {
    status: ssrResult.status,
    headers: {
      "Content-type": "text/html",
    },
  });
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
  const url = new URL(request.url);
  const pathname = stripBasePath(url.pathname);
  if (pathname === devMainRscPath) {
    // root RSC stream is requested
    const rootRscStream = await devMainRSCStream();
    return new Response(rootRscStream, {
      status: 200,
      headers: {
        "content-type": "text/x-component;charset=utf-8",
      },
    });
  }

  const moduleId = extractIDFromModulePath(pathname);
  if (!moduleId) {
    throw new ServeRSCError(`Invalid RSC module path: ${pathname}`, 404);
  }

  const entry = deferRegistry.load(moduleId);
  if (!entry) {
    throw new ServeRSCError(`RSC component not found: ${moduleId}`, 404);
  }
  const { state } = entry;
  switch (state.state) {
    case "streaming": {
      return new Response(state.stream, {
        status: 200,
        headers: {
          "content-type": "text/x-component;charset=utf-8",
        },
      });
    }
    case "ready": {
      return new Response(state.data, {
        status: 200,
        headers: {
          "content-type": "text/x-component;charset=utf-8",
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

  const Root = (await import("virtual:funstack/root")).default;
  const App = (await import("virtual:funstack/app")).default;

  const rootRscStream = renderToReadableStream<RscPayload>({
    root: (
      <Root>
        <span id={marker} />
      </Root>
    ),
  });

  const appRscStream = renderToReadableStream<RscPayload>({
    root: <App />,
  });

  const ssrEntryModule = await import.meta.viteRsc.loadModule<
    typeof import("../ssr/entry")
  >("ssr");

  const ssrResult = await ssrEntryModule.renderHTML(rootRscStream, {
    appEntryMarker: marker,
    build: true,
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

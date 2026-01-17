import "./send";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import { parseRenderRequest } from "./request";
import { generateAppMarker } from "./marker";
import { sendRegistry } from "./send";
import { drainStream } from "../util/drainStream";
import { extractIDFromModulePath } from "./rscModule";

// The schema of payload which is serialized into RSC stream on rsc environment
// and deserialized on ssr/client environments.
export type RscPayload = {
  // this demo renders/serializes/deserizlies entire root html element
  // but this mechanism can be changed to render/fetch different parts of components
  // based on your own route conventions.
  root: React.ReactNode;
};

/**
 * Entrypoint to serve HTML response
 */
export async function serveHTML(request: Request): Promise<Response> {
  // differentiate RSC, SSR, action, etc.
  const renderRequest = parseRenderRequest(request);
  request = renderRequest.request;

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

  const marker = generateAppMarker();

  const rootRscStream = renderToReadableStream<RscPayload>({
    root: (
      <Root>
        <App />
      </Root>
    ),
  });

  // Respond RSC stream without HTML rendering as decided by `RenderRequest`
  if (renderRequest.isRsc) {
    return new Response(rootRscStream, {
      status: 200,
      headers: {
        "content-type": "text/x-component;charset=utf-8",
      },
    });
  }

  // Delegate to SSR environment for html rendering.
  // The plugin provides `loadModule` helper to allow loading SSR environment entry module
  // in RSC environment. however this can be customized by implementing own runtime communication
  // e.g. `@cloudflare/vite-plugin`'s service binding.
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
  const moduleId = extractIDFromModulePath(url.pathname);
  if (!moduleId) {
    throw new ServeRSCError(`Invalid RSC module path: ${url.pathname}`, 404);
  }

  const entry = sendRegistry.load(moduleId);
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
  };
}

export { send, sendRegistry } from "./send";

if (import.meta.hot) {
  import.meta.hot.accept();
}

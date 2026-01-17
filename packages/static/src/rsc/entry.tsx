import "./send";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import { parseRenderRequest } from "./request";
import { generateAppMarker } from "./marker";
import { sendRegistry } from "./send";
import { drainStream } from "../util/drainStream";

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

/**
 * Generate ES Module for given RSC entrypoint
 */
export async function serveRSC(moduleId: string) {
  const entry = sendRegistry.load(moduleId);
  if (!entry) {
    throw new Error(`RSC component not found: ${moduleId}`);
  }
  const rscStream = renderToReadableStream<RscPayload>({
    root: <entry.component />,
  });

  const result = `"use client";
import { use } from "react";
const payload =\`${await drainStream(rscStream)}\`;
let stream;
export default () => {
  stream ??= new ReadableStream([
    new TextEncoder().encode(payload),
  ]);
  return use(stream);
};
`;

  return result;
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

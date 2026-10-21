import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";
import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { prerender } from "react-dom/static";
import { injectRSCPayload } from "rsc-html-stream/server";
import type { RscPayload } from "../rsc/entry";
import { appClientManifestVar } from "../client/globals";
import { rscPayloadPlaceholder } from "../build/rscPath";
import { preload } from "react-dom";
import type { DeferRegistry } from "../rsc/deferRegistry";
import { RegistryContext } from "#rsc-client";
import { withBasePath } from "../util/basePath";

/**
 * The only script a page without client JavaScript (`clientScript: false`)
 * carries in dev: it connects to Vite's HMR channel so that an edit reloads
 * the page (and a server error shows Vite's overlay). It loads no React, so
 * the page behaves as the production build does — Client Components render
 * as static HTML and are not interactive.
 *
 * `rsc:update` is sent by `@vitejs/plugin-rsc` when a server module changes.
 * A `js-update` is sent for a changed Client Component module, which this
 * page cannot hot-replace (no module of its own is loaded), so it reloads
 * too. CSS updates are left to Vite's client, which swaps the `<link>` tags
 * in place.
 */
function devReloadScriptContent(): string {
  const viteClient = JSON.stringify(withBasePath("/@vite/client"));
  return [
    `import(${viteClient}).then(({ createHotContext }) => {`,
    `  const hot = createHotContext("/__funstack_static_reload");`,
    `  hot.on("rsc:update", () => location.reload());`,
    `  hot.on("vite:beforeUpdate", (payload) => {`,
    `    if (payload.updates.some((update) => update.type === "js-update")) {`,
    `      location.reload();`,
    `    }`,
    `  });`,
    `});`,
  ].join("\n");
}

export async function renderHTML(
  rscStream: ReadableStream<Uint8Array>,
  options: {
    appEntryMarker: string;
    build: boolean;
    ssr?: boolean;
    /**
     * Whether the page loads the client runtime. When `false`, the HTML
     * carries no bootstrap script, no RSC payload (inline or preloaded) and
     * nothing is hydrated; the RSC stream must then hold the full tree.
     * In dev, a small reload-on-change script is injected instead.
     *
     * @default true
     */
    clientScript?: boolean;
    nonce?: string;
    deferRegistry?: DeferRegistry;
    clientRscStream?: ReadableStream<Uint8Array>;
    /**
     * Receives errors reported while prerendering (build only). Without it,
     * React logs them with `console.error`.
     */
    onError?: (error: unknown) => void;
  },
): Promise<{ stream: ReadableStream<Uint8Array>; status?: number }> {
  const clientScript = options.clientScript !== false;

  // Tee only when the second branch is actually consumed (dev without a
  // separate client RSC stream). An unread tee branch buffers the entire
  // RSC payload in memory, so skip teeing in build mode, in dev when
  // `clientRscStream` is injected instead, and for pages without client
  // JavaScript (nothing in the browser would read the payload).
  let ssrRscStream = rscStream;
  let inlineRscStream = options.clientRscStream;
  if (!options.build && clientScript && inlineRscStream === undefined) {
    [ssrRscStream, inlineRscStream] = rscStream.tee();
  }

  let payload: Promise<RscPayload> | undefined;
  function SsrRoot() {
    // Tip: calling `createFromReadableStream` inside a component
    // makes `preinit`/`preload` work properly.
    payload ??= createFromReadableStream<RscPayload>(ssrRscStream);
    if (options.build && clientScript) {
      preload(rscPayloadPlaceholder, {
        crossOrigin: "anonymous",
        as: "fetch",
      });
    }
    return (
      <RegistryContext
        value={
          options.deferRegistry
            ? {
                registry: options.deferRegistry,
                createFromReadableStream,
              }
            : undefined
        }
      >
        {use(payload).root}
      </RegistryContext>
    );
  }

  // `undefined` (rather than "") so React emits no <script> at all for a
  // page without client JavaScript in production.
  let bootstrapScriptContent: string | undefined;
  if (!clientScript) {
    bootstrapScriptContent = options.build
      ? undefined
      : devReloadScriptContent();
  } else {
    bootstrapScriptContent = "";
    if (options.build) {
      if (options.ssr) {
        // SSR on: no marker needed, client hydrates full document
        bootstrapScriptContent += `globalThis.${appClientManifestVar}={stream:"${rscPayloadPlaceholder}"};\n`;
      } else {
        // SSR off: marker needed for client to find mount point
        bootstrapScriptContent += `globalThis.${appClientManifestVar}={marker:"${options.appEntryMarker}",stream:"${rscPayloadPlaceholder}"};\n`;
      }
    }
    bootstrapScriptContent +=
      await import.meta.viteRsc.loadBootstrapScriptContent("index");
  }

  let htmlStream: ReadableStream<Uint8Array>;
  let status: number | undefined;
  try {
    if (options.build) {
      const { prelude, postponed } = await prerender(<SsrRoot />, {
        bootstrapScriptContent,
        onError: options.onError,
      });
      if (postponed !== null) {
        throw new Error("Unexpected postponed state during prerendering");
      }

      htmlStream = prelude;
    } else {
      htmlStream = await renderToReadableStream(<SsrRoot />, {
        bootstrapScriptContent,
        nonce: options?.nonce,
      });
    }
  } catch (e) {
    if (options.build) {
      // In build mode, abort the build so the error is not silently swallowed.
      throw e;
    }
    status = 500;
    if (!clientScript) {
      // No client runtime to recover with: show the error, and keep the
      // reload script so fixing the code refreshes the page.
      htmlStream = await renderToReadableStream(
        <html>
          <body>
            <h1>Internal Server Error: SSR failed</h1>
            <pre>{e instanceof Error ? (e.stack ?? e.message) : String(e)}</pre>
          </body>
        </html>,
        { bootstrapScriptContent, nonce: options?.nonce },
      );
    } else {
      // In dev mode, RSC payload is still sent to client and we let client render from scratch anyway.
      // This triggers the error boundary on client side.
      htmlStream = await renderToReadableStream(
        <html>
          <body>
            <noscript>Internal Server Error: SSR failed</noscript>
          </body>
        </html>,
        {
          bootstrapScriptContent:
            `globalThis.__NO_HYDRATE=1;` + bootstrapScriptContent,
          nonce: options?.nonce,
        },
      );
    }
  }

  let responseStream = htmlStream;

  // Inject RSC payload into HTML for client consumption.
  // In dev: always inject (client reads from inline stream).
  // In build+SSR: skip (HTML already has full content, client hydrates directly).
  // In build+no-SSR: skip (client fetches RSC from separate file).
  // Without client JavaScript: skip (nothing would read it).
  if (!options.build && inlineRscStream !== undefined) {
    responseStream = responseStream.pipeThrough(
      injectRSCPayload(inlineRscStream, {
        nonce: options?.nonce,
      }),
    );
  }

  return { stream: responseStream, status };
}

import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";
import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { prerender } from "react-dom/static";
import { injectRSCPayload } from "rsc-html-stream/server";
import type { RscPayload } from "../rsc/entry";
import { appClientManifestVar } from "../client/globals";
import { rscPayloadPlaceholder } from "../build/rscPath";
import { preload } from "react-dom";
import type { DeferRegistry } from "../rsc/defer";
import { RegistryContext } from "#rsc-client";

export async function renderHTML(
  rscStream: ReadableStream<Uint8Array>,
  options: {
    appEntryMarker: string;
    build: boolean;
    ssr?: boolean;
    nonce?: string;
    deferRegistry?: DeferRegistry;
    clientRscStream?: ReadableStream<Uint8Array>;
  },
): Promise<{ stream: ReadableStream<Uint8Array>; status?: number }> {
  const [rscStream1, rscStream2] = rscStream.tee();

  let payload: Promise<RscPayload> | undefined;
  function SsrRoot() {
    // Tip: calling `createFromReadableStream` inside a component
    // makes `preinit`/`preload` work properly.
    payload ??= createFromReadableStream<RscPayload>(rscStream1);
    if (options.build) {
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

  let bootstrapScriptContent: string = "";
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

  let htmlStream: ReadableStream<Uint8Array>;
  let status: number | undefined;
  try {
    if (options.build) {
      const { prelude, postponed } = await prerender(<SsrRoot />, {
        bootstrapScriptContent,
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
    // In dev mode, RSC payload is still sent to client and we let client render from scratch anyway.
    // This triggers the error boundary on client side.
    status = 500;
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

  let responseStream = htmlStream;

  // Inject RSC payload into HTML for client consumption.
  // In dev: always inject (client reads from inline stream).
  // In build+SSR: skip (HTML already has full content, client hydrates directly).
  // In build+no-SSR: skip (client fetches RSC from separate file).
  if (!options.build) {
    const streamToInject = options.clientRscStream ?? rscStream2;
    responseStream = responseStream.pipeThrough(
      injectRSCPayload(streamToInject, {
        nonce: options?.nonce,
      }),
    );
  }

  return { stream: responseStream, status };
}

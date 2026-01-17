import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";
import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";
import { injectRSCPayload } from "rsc-html-stream/server";
import type { RscPayload } from "../rsc/entry";
import { appClientManifestVar } from "../client/globals";
import { rscPayloadPath } from "../build/rscPath";
import { preload } from "react-dom";
import type { SendRegistry } from "../rsc/send";
import { RegistryContext } from "../rsc-client/clientWrapper";

export async function renderHTML(
  rscStream: ReadableStream<Uint8Array>,
  options: {
    appEntryMarker: string;
    build: boolean;
    nonce?: string;
    sendRegistry?: SendRegistry;
  },
): Promise<{ stream: ReadableStream<Uint8Array>; status?: number }> {
  const [rscStream1, rscStream2] = rscStream.tee();

  let payload: Promise<RscPayload> | undefined;
  function SsrRoot() {
    // Tip: calling `createFromReadableStream` inside a component
    // makes `preinit`/`preload` work properly.
    payload ??= createFromReadableStream<RscPayload>(rscStream1);
    if (options.build) {
      preload(rscPayloadPath, {
        crossOrigin: "anonymous",
        as: "fetch",
      });
    }
    return (
      <RegistryContext value={options.sendRegistry}>
        {use(payload).root}
      </RegistryContext>
    );
  }

  const builtRscUrl = rscPayloadPath;
  let bootstrapScriptContent: string = "";
  if (options.build) {
    bootstrapScriptContent += `globalThis.${appClientManifestVar}={marker:"${options.appEntryMarker}",stream:"${builtRscUrl}"};\n`;
  }
  bootstrapScriptContent +=
    await import.meta.viteRsc.loadBootstrapScriptContent("index");

  let htmlStream: ReadableStream<Uint8Array>;
  let status: number | undefined;
  try {
    htmlStream = await renderToReadableStream(<SsrRoot />, {
      bootstrapScriptContent,
      nonce: options?.nonce,
    });
  } catch (e) {
    // In this case, RSC payload is still sent to client and we let client render from scratch anyway.
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

  if (!options.build) {
    responseStream = responseStream.pipeThrough(
      injectRSCPayload(rscStream2, {
        nonce: options?.nonce,
      }),
    );
  }

  return { stream: responseStream, status };
}

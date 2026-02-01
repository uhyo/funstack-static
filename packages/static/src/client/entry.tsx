// Client initialization - runs before React (side effects only)
import "virtual:funstack/client-init";

import {
  createFromReadableStream,
  createFromFetch,
} from "@vitejs/plugin-rsc/browser";
import React, { startTransition, useEffect, useState } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { rscStream } from "rsc-html-stream/client";
import { GlobalErrorBoundary } from "./error-boundary";
import type { RscPayload } from "../rsc/entry";
import { devMainRscPath } from "../rsc/request";
import { appClientManifestVar, type AppClientManifest } from "./globals";
import { withBasePath } from "../util/basePath";

import { ssr as ssrEnabled } from "virtual:funstack/config";

async function devMain() {
  let setPayload: (v: RscPayload) => void;

  const initialPayload = await createFromReadableStream<RscPayload>(rscStream);

  function BrowserRoot() {
    const [payload, setPayload_] = useState(initialPayload);

    useEffect(() => {
      setPayload = (v) => startTransition(() => setPayload_(v));
    }, [setPayload_]);

    return payload.root;
  }

  // re-fetch RSC and trigger re-rendering
  async function fetchRscPayload() {
    const payload = await createFromFetch<RscPayload>(
      fetch(withBasePath(devMainRscPath)),
    );
    setPayload(payload);
  }

  const browserRoot = (
    <React.StrictMode>
      <GlobalErrorBoundary>
        <BrowserRoot />
      </GlobalErrorBoundary>
    </React.StrictMode>
  );

  if (
    // @ts-expect-error
    globalThis.__NO_HYDRATE
  ) {
    // This happens when SSR failed on server
    createRoot(document).render(browserRoot);
  } else if (ssrEnabled) {
    hydrateRoot(document, browserRoot);
  } else {
    // SSR off: Root shell is static HTML, mount App client-side
    createRoot(document).render(browserRoot);
  }

  // implement server HMR by triggering re-fetch/render of RSC upon server code change
  if (import.meta.hot) {
    import.meta.hot.on("rsc:update", () => {
      fetchRscPayload();
    });
  }
}

async function prodMain() {
  const manifest: AppClientManifest =
    // @ts-expect-error
    globalThis[appClientManifestVar];

  const payload = await createFromFetch<RscPayload>(fetch(manifest.stream));

  function BrowserRoot() {
    return payload.root;
  }

  if (ssrEnabled) {
    // SSR on: full tree was SSR'd, hydrate from RSC payload
    const browserRoot = (
      <React.StrictMode>
        <GlobalErrorBoundary>
          <BrowserRoot />
        </GlobalErrorBoundary>
      </React.StrictMode>
    );

    hydrateRoot(document, browserRoot);
  } else {
    // SSR off: Root shell only, mount App client-side
    const browserRoot = <BrowserRoot />;
    const appRootId = manifest.marker!;

    const appMarker = document.getElementById(appRootId);
    if (!appMarker) {
      throw new Error(
        `Failed to find app root element by id "${appRootId}". This is likely a bug.`,
      );
    }
    const appRoot = appMarker.parentElement;
    if (!appRoot) {
      throw new Error(
        `App root element has no parent element. This is likely a bug.`,
      );
    }
    appMarker.remove();

    createRoot(appRoot).render(browserRoot);
  }
}

if (import.meta.env.DEV) {
  devMain();
} else {
  prodMain();
}

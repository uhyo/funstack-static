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
import { findAppMarker, warnIfDestructiveMount } from "./mount-validation";
import { withBasePath } from "../util/basePath";

import { ssr as ssrEnabled } from "virtual:funstack/config";

async function devMain() {
  // Holds an update that arrived before the component mounted; the mount
  // effect applies it so early rsc:update events are not dropped.
  let pendingPayload: RscPayload | undefined;
  let setPayload: (v: RscPayload) => void = (v) => {
    pendingPayload = v;
  };

  const initialPayload = await createFromReadableStream<RscPayload>(rscStream);

  function BrowserRoot() {
    const [payload, setPayload_] = useState(initialPayload);

    useEffect(() => {
      setPayload = (v) => startTransition(() => setPayload_(v));
      if (pendingPayload !== undefined) {
        const payload = pendingPayload;
        pendingPayload = undefined;
        setPayload(payload);
      }
    }, [setPayload_]);

    return payload.root;
  }

  // re-fetch RSC and trigger re-rendering
  async function fetchRscPayload() {
    // Pass the current page path so the server re-renders the entry
    // being viewed rather than the first entry
    const rscUrl = `${withBasePath(devMainRscPath)}?path=${encodeURIComponent(
      location.pathname,
    )}`;
    const payload = await createFromFetch<RscPayload>(fetch(rscUrl));
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
    // SSR off: Root shell is static HTML, mount App client-side.
    // The served shell has the same shape as the production build
    // (marker span inside its container), so validate it before React
    // replaces the document — this surfaces in dev the content that a
    // production mount would destroy.
    const appMarker = findAppMarker();
    if (appMarker) {
      warnIfDestructiveMount(appMarker);
    }
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
    // SSR off: Root shell only, mount App client-side.
    // The error boundary is embedded because the mount point is an inner
    // element, where the document-level fallback's <html> would be invalid.
    const browserRoot = (
      <React.StrictMode>
        <GlobalErrorBoundary embedded>
          <BrowserRoot />
        </GlobalErrorBoundary>
      </React.StrictMode>
    );
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
    warnIfDestructiveMount(appMarker);
    appMarker.remove();

    createRoot(appRoot).render(browserRoot);
  }
}

if (import.meta.env.DEV) {
  devMain();
} else {
  prodMain();
}

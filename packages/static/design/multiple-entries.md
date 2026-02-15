# Design: Multiple Entries

## Summary

Add support for multiple entry points so that a single project can produce multiple HTML pages at build time. Instead of the current single `root`+`app` pair, users can specify an `entries` option that exports a function returning an array of entry definitions. Each entry produces its own HTML file, RSC payload, and deferred component set.

This is aimed at SSG (Static Site Generation) use cases where a site has multiple distinct pages (e.g. `/`, `/about`, `/blog/post-1`) that should each be pre-rendered to their own `index.html`.

## Current Architecture

Today the plugin accepts a single entry point pair:

```ts
funstackStatic({
  root: "./src/root.tsx",   // HTML shell (<html>...</html>)
  app: "./src/App.tsx",     // Application content
})
```

This flows through the system as:

1. **Virtual modules** `virtual:funstack/root` and `virtual:funstack/app` resolve to the user-provided paths.
2. **RSC entry** (`rsc/entry.tsx`) imports both, renders `<Root><App /></Root>` to RSC streams.
3. **SSR entry** (`ssr/entry.tsx`) converts the RSC stream to an HTML stream.
4. **Build** (`build/buildApp.ts`) writes a single `index.html`, a single main RSC payload, and deferred component payloads.
5. **Client** (`client/entry.tsx`) reads a single manifest (`AppClientManifest`) and hydrates/mounts once.

Key constraint: everything is hard-wired to one root, one app, one HTML output.

## Proposed Design

### User-Facing API

A new `entries` option is added to `FunstackStaticOptions`, mutually exclusive with `root`+`app`:

```ts
// Option A: single entry (existing, unchanged)
funstackStatic({
  root: "./src/root.tsx",
  app: "./src/App.tsx",
})

// Option B: multiple entries (new)
funstackStatic({
  entries: "./src/entries.tsx",
})
```

The `entries` module is a meta-entry point. It exports a function that returns the list of concrete entries to build:

```ts
// src/entries.tsx
import type { EntryDefinition } from "@funstack/static/entries";

export default function getEntries(): EntryDefinition[] {
  return [
    {
      path: "/",
      root: () => import("./root"),
      app: () => import("./pages/Home"),
    },
    {
      path: "/about",
      root: () => import("./root"),
      app: () => import("./pages/About"),
    },
  ];
}
```

#### `EntryDefinition`

```ts
export interface EntryDefinition {
  /**
   * The URL path this entry corresponds to.
   * Determines the output file location:
   *   "/" -> "index.html"
   *   "/about" -> "about/index.html"
   *   "/blog/post-1" -> "blog/post-1/index.html"
   */
  path: string;
  /**
   * Lazy import for the root component module.
   * The module must `export default` a React component.
   */
  root: () => Promise<{ default: React.ComponentType<{ children: React.ReactNode }> }>;
  /**
   * Lazy import for the app component module.
   * The module must `export default` a React component.
   */
  app: () => Promise<{ default: React.ComponentType }>;
}
```

**Design rationale: why a function with lazy imports?**

- Using `() => import(...)` (lazy imports) allows the entries module itself to be lightweight. Component code is only loaded when the specific entry is being built. This avoids loading every page's code into memory at once.
- A function (rather than a static array) gives users the ability to programmatically generate entries (e.g. reading a directory of markdown files, querying a CMS at build time).
- The entries module runs in the RSC environment at build time, so it has access to Node.js APIs for dynamic generation.

### Updated Options Type

```ts
export type FunstackStaticOptions = FunstackStaticBaseOptions &
  (SingleEntryOptions | MultipleEntriesOptions);

interface FunstackStaticBaseOptions {
  publicOutDir?: string;
  ssr?: boolean;
  clientInit?: string;
}

interface SingleEntryOptions {
  root: string;
  app: string;
  entries?: never;
}

interface MultipleEntriesOptions {
  root?: never;
  app?: never;
  entries: string;
}
```

This enforces at the type level that you specify either `root`+`app` or `entries`, not both.

### Internal Architecture Changes

#### 1. Virtual Module Resolution

Currently `virtual:funstack/root` and `virtual:funstack/app` resolve to fixed paths. With `entries` mode, these virtual modules are not used in the same way because each entry has its own root and app.

**Approach**: When `entries` is specified, introduce a new virtual module:

- `virtual:funstack/entries` — resolves to the user-provided entries module.

The existing `virtual:funstack/root` and `virtual:funstack/app` modules become unused in entries mode. They can either be left unresolved (triggering an error if accidentally imported) or could point to a stub that throws an explanatory error.

#### 2. RSC Entry Changes (`rsc/entry.tsx`)

The RSC entry needs a new `buildEntries()` function alongside the existing `build()`:

```ts
// New: build all entries
export async function buildEntries() {
  const getEntries = (await import("virtual:funstack/entries")).default;
  const entries = await getEntries();

  const results: EntryBuildResult[] = [];
  for (const entry of entries) {
    // Reset defer registry per entry so deferred components
    // are scoped to each page.
    deferRegistry.clear();

    const RootModule = await entry.root();
    const AppModule = await entry.app();
    const Root = RootModule.default;
    const App = AppModule.default;

    const marker = generateAppMarker();

    // Same RSC rendering logic as today, but with per-entry components
    let rootRscStream: ReadableStream<Uint8Array>;
    let appRscStream: ReadableStream<Uint8Array>;

    if (ssrEnabled) {
      rootRscStream = renderToReadableStream<RscPayload>({
        root: <Root><App /></Root>,
      });
      appRscStream = renderToReadableStream<RscPayload>({
        root: <Root><App /></Root>,
      });
    } else {
      rootRscStream = renderToReadableStream<RscPayload>({
        root: <Root><span id={marker} /></Root>,
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

    results.push({
      path: entry.path,
      html: ssrResult.stream,
      appRsc: appRscStream,
      deferredEntries: deferRegistry.loadAll(),
    });
  }

  return results;
}
```

**Key point**: the defer registry is cleared between entries. Each page gets its own set of deferred components. This avoids cross-page interference and keeps output predictable.

#### 3. Build Pipeline Changes (`build/buildApp.ts`)

The build function needs to handle the multi-entry case:

```ts
export async function buildApp(builder: ViteBuilder, context: MinimalPluginContextWithoutEnvironment) {
  const { config } = builder;
  const entryPath = path.join(config.environments.rsc.build.outDir, "index.js");
  const entry = await import(pathToFileURL(entryPath).href);

  const baseDir = config.environments.client.build.outDir;
  const base = normalizeBase(config.base);

  if (entry.buildEntries) {
    // Multi-entry mode
    const results = await entry.buildEntries();
    for (const result of results) {
      await buildSingleEntry(result, baseDir, base, context);
    }
  } else {
    // Single-entry mode (existing behavior, unchanged)
    const { html, appRsc, deferRegistry } = await entry.build();
    // ... existing logic ...
  }
}

async function buildSingleEntry(
  result: EntryBuildResult,
  baseDir: string,
  base: string,
  context: MinimalPluginContextWithoutEnvironment,
) {
  const { path: entryPath, html, appRsc, deferredEntries } = result;

  const htmlContent = await drainStream(html);
  const { components, appRscContent } = await processRscComponents(
    deferredEntries,
    appRsc,
    context,
  );

  const mainPayloadHash = await computeContentHash(appRscContent);
  const mainPayloadPath = base + getRscPayloadPath(mainPayloadHash);

  const finalHtmlContent = htmlContent.replaceAll(
    rscPayloadPlaceholder,
    mainPayloadPath,
  );

  // Derive output path from entry path
  const htmlOutputPath = entryPath === "/"
    ? "index.html"
    : `${entryPath.replace(/^\//, "")}/index.html`;

  await writeFileNormal(
    path.join(baseDir, htmlOutputPath),
    finalHtmlContent,
    context,
  );

  await writeFileNormal(
    path.join(baseDir, getRscPayloadPath(mainPayloadHash).replace(/^\//, "")),
    appRscContent,
    context,
  );

  for (const { finalId, finalContent, name } of components) {
    const filePath = path.join(
      baseDir,
      getModulePathFor(finalId).replace(/^\//, ""),
    );
    await writeFileNormal(filePath, finalContent, context, name);
  }
}
```

**Note on deferred component deduplication**: If two entries share the same deferred component (same content), they will naturally get the same content hash and thus the same file path. The second write is a no-op overwrite of identical content. This is by design — no special deduplication logic is needed.

#### 4. Dev Server Changes (`plugin/server.ts`)

In dev mode, the dev server currently routes all HTML requests to a single `serveHTML()`. With multiple entries, the server needs to match the request path to the correct entry:

```ts
// In dev middleware
if (req.headers.accept?.includes("text/html")) {
  const rscEntry = await getRSCEntryPoint(rscEnv);
  if (rscEntry.serveHTMLForPath) {
    // Multi-entry mode: pass the request path
    const fetchHandler = toNodeHandler((request: Request) =>
      rscEntry.serveHTMLForPath(request)
    );
    await fetchHandler(req, res);
  } else {
    // Single-entry mode (existing)
    const fetchHandler = toNodeHandler(rscEntry.serveHTML);
    await fetchHandler(req, res);
  }
  return;
}
```

The RSC entry gains a new `serveHTMLForPath()` that:
1. Loads the entries list.
2. Matches the request URL path against entry paths.
3. Loads the matched entry's root and app components.
4. Renders and returns the HTML, same as today's `serveHTML()` but with per-entry components.

For dev, entries can be cached after first load and invalidated on HMR.

#### 5. Preview Server Changes (`plugin/server.ts`)

The preview server currently serves a single `index.html`. With multiple entries, it needs to look up the correct HTML file based on the request path:

```ts
// In preview middleware
if (req.headers.accept?.includes("text/html")) {
  const urlPath = new URL(req.url!, `http://${req.headers.host}`).pathname;
  const htmlPath = urlPath === "/" || urlPath === ""
    ? "index.html"
    : `${urlPath.replace(/^\//, "").replace(/\/$/, "")}/index.html`;
  const html = await readFile(path.join(resolvedOutDir, htmlPath), "utf-8");
  res.end(html);
  return;
}
```

#### 6. Client Entry (`client/entry.tsx`)

No changes needed. Each HTML page already includes its own manifest (`AppClientManifest`) with the correct RSC payload path. The client entry is the same script included in every page — it reads whatever manifest is in the page's `<script>` and hydrates/mounts accordingly.

### Output Structure

Given entries for `/`, `/about`, and `/blog/post-1`:

```
dist/public/
├── index.html                                    # /
├── about/
│   └── index.html                                # /about
├── blog/
│   └── post-1/
│       └── index.html                            # /blog/post-1
├── funstack__/
│   └── fun:rsc-payload/
│       ├── a1b2c3d4e5f6g7h8.txt                  # RSC payload for /
│       ├── i9j0k1l2m3n4o5p6.txt                  # RSC payload for /about
│       ├── q7r8s9t0u1v2w3x4.txt                  # RSC payload for /blog/post-1
│       ├── {hash}.txt                             # deferred components (shared by hash)
│       └── ...
└── assets/
    ├── client.js                                  # Client bundle (shared)
    └── ...
```

All pages share the same client JS bundle. Only the HTML and RSC payloads differ per page.

### Migration & Backward Compatibility

- The existing `root`+`app` API is fully preserved. No changes to existing behavior.
- `entries` mode is purely additive. The single-entry path remains the default and recommended approach for single-page apps.
- Internally, single-entry mode is **not** rewritten to use the entries codepath. Keeping the two paths separate avoids regressions and keeps the single-entry path simple.

### Edge Cases and Considerations

#### Duplicate paths
If two entries declare the same `path`, the build should fail with a clear error message listing the conflicting path.

#### Trailing slashes
Entry paths are normalized: `/about` and `/about/` are treated identically and both produce `about/index.html`.

#### Defer registry isolation
The defer registry is global mutable state. Between entries, it must be cleared to prevent one entry's deferred components from leaking into another's output. The `deferRegistry.clear()` method will be added for this purpose.

#### Shared deferred components
If the same component is deferred by multiple pages, each page's RSC payload will reference it by content hash. Since hashes are deterministic, the same content produces the same file — no conflicts, just idempotent writes.

#### Memory usage
Entries are built sequentially (not in parallel) to keep memory usage bounded. Each entry's RSC streams and HTML are fully drained before moving to the next.

#### Client-side navigation between entries
Each entry is a fully independent HTML page. Navigation between entries is a full page load (standard `<a>` link behavior). Client-side routing within an entry still works as before. This is intentional for SSG — each page is self-contained.

## Scope and Non-Goals

### In scope
- The `entries` option and `EntryDefinition` type.
- Build pipeline producing multiple HTML files.
- Dev server routing to the correct entry by path.
- Preview server serving the correct HTML by path.

### Non-goals (future work)
- **Shared layout deduplication**: Extracting shared layout RSC payloads between entries. Not needed initially; content hashing already handles shared deferred components.
- **Incremental builds**: Only rebuilding changed entries. The build is fast enough for reasonable numbers of entries.
- **Dynamic parameters / catch-all routes**: Something like `path: "/blog/[slug]"` that expands at build time. Users can achieve this by generating the entries array programmatically in their `getEntries()` function.
- **Dev-mode lazy entry building**: In dev, all entries are defined upfront. No lazy discovery.

## Implementation Plan

1. **Type definitions**: Add `EntryDefinition` export and update `FunstackStaticOptions` union type.
2. **Virtual module**: Add `virtual:funstack/entries` resolution in the plugin.
3. **RSC entry**: Add `buildEntries()` and `serveHTMLForPath()` functions. Add `deferRegistry.clear()`.
4. **Build pipeline**: Add multi-entry loop in `buildApp()`, with path normalization and duplicate detection.
5. **Dev server**: Route HTML requests to the correct entry.
6. **Preview server**: Serve the correct HTML file by path.
7. **Tests**: Unit tests for path normalization and duplicate detection. E2E test with a multi-entry fixture.
8. **Documentation**: Update README and docs site with the new option.

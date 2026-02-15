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

### Unified Internal Architecture

Internally, both configuration styles are normalized to the same multi-entry codepath. When `root`+`app` is specified, the plugin synthesizes an entries module that wraps them as a single entry. This means there is only one rendering and build codepath to maintain.

#### 1. Virtual Module Resolution

A new virtual module `virtual:funstack/entries` is always generated, regardless of which configuration style the user chose.

**When `entries` is specified** — the virtual module re-exports the user's module:

```ts
// Generated virtual:funstack/entries
export { default } from "/resolved/path/to/user/entries.tsx";
```

**When `root`+`app` is specified** — the virtual module synthesizes a single-entry array:

```ts
// Generated virtual:funstack/entries
import Root from "/resolved/path/to/root.tsx";
import App from "/resolved/path/to/app.tsx";
export default function getEntries() {
  return [{
    path: "/",
    root: () => Promise.resolve({ default: Root }),
    app: () => Promise.resolve({ default: App }),
  }];
}
```

The existing `virtual:funstack/root` and `virtual:funstack/app` modules are removed. They are no longer needed since entry components are always loaded via the entries module.

#### 2. RSC Entry Changes (`rsc/entry.tsx`)

The existing `build()` function is replaced by a unified `build()` that iterates over all entries:

```ts
export async function build() {
  const getEntries = (await import("virtual:funstack/entries")).default;
  const entries = await getEntries();

  const ssrEntryModule = await import.meta.viteRsc.loadModule<
    typeof import("../ssr/entry")
  >("ssr");

  const results: EntryBuildResult[] = [];
  for (const entry of entries) {
    const RootModule = await entry.root();
    const AppModule = await entry.app();
    const Root = RootModule.default;
    const App = AppModule.default;

    const marker = generateAppMarker();

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

    const ssrResult = await ssrEntryModule.renderHTML(rootRscStream, {
      appEntryMarker: marker,
      build: true,
      ssr: ssrEnabled,
    });

    results.push({
      path: entry.path,
      html: ssrResult.stream,
      appRsc: appRscStream,
    });
  }

  return {
    entries: results,
    deferRegistry,
  };
}
```

**Key point**: the defer registry is **not** cleared between entries. All deferred components from all entries accumulate in the single global registry. This avoids redundant computation — if multiple entries defer the same component, it is rendered once and shared via content hashing. The registry is returned alongside the per-entry results so that the build pipeline can process all deferred components in one pass.

#### 3. Build Pipeline Changes (`build/buildApp.ts`)

Since single-entry and multi-entry are unified, the build function always receives the same shape from `build()`:

```ts
export async function buildApp(builder: ViteBuilder, context: MinimalPluginContextWithoutEnvironment) {
  const { config } = builder;
  const entryPath = path.join(config.environments.rsc.build.outDir, "index.js");
  const entry = await import(pathToFileURL(entryPath).href);

  const baseDir = config.environments.client.build.outDir;
  const base = normalizeBase(config.base);

  const { entries, deferRegistry } = await entry.build();

  // Process all deferred components once across all entries
  const allDeferredEntries = deferRegistry.loadAll();
  const { components, idMapping } = await processDeferredComponents(
    allDeferredEntries,
    context,
  );

  // Write each entry's HTML and RSC payload
  for (const result of entries) {
    await buildSingleEntry(result, idMapping, baseDir, base, context);
  }

  // Write all deferred component payloads
  for (const { finalId, finalContent, name } of components) {
    const filePath = path.join(
      baseDir,
      getModulePathFor(finalId).replace(/^\//, ""),
    );
    await writeFileNormal(filePath, finalContent, context, name);
  }
}

async function buildSingleEntry(
  result: EntryBuildResult,
  idMapping: Map<string, string>,
  baseDir: string,
  base: string,
  context: MinimalPluginContextWithoutEnvironment,
) {
  const { path: entryPath, html, appRsc } = result;

  const htmlContent = await drainStream(html);

  // Replace temp IDs with final hashed IDs in this entry's RSC payload
  const appRscContent = replaceIdsInContent(
    await drainStream(appRsc),
    idMapping,
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
}
```

Since the defer registry accumulates across all entries, deferred components are processed exactly once. The `idMapping` (temp UUID to final content hash) is computed once and then applied to each entry's RSC payload individually.

**Note on deferred component deduplication**: If two entries defer the same component (same content), it naturally gets one content hash and one output file. No special deduplication logic is needed.

#### 4. Dev Server Changes (`plugin/server.ts`)

Since the architecture is unified, the dev server always calls the same `serveHTML()` function, which now accepts a `Request` to determine the path:

```ts
// In dev middleware
if (req.headers.accept?.includes("text/html")) {
  const rscEntry = await getRSCEntryPoint(rscEnv);
  const fetchHandler = toNodeHandler(rscEntry.serveHTML);
  await fetchHandler(req, res);
  return;
}
```

The `serveHTML()` function in `rsc/entry.tsx` is updated to:
1. Load the entries list via `virtual:funstack/entries`.
2. Match the request URL path against entry paths (for single-entry `root`+`app` configs, the synthesized entries array has one entry with `path: "/"` which matches all requests).
3. Load the matched entry's root and app components.
4. Render and return the HTML.

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

- The existing `root`+`app` API is fully preserved. No changes to user-facing behavior.
- `entries` mode is purely additive. The single-entry configuration remains the default and recommended approach for single-page apps.
- Internally, `root`+`app` is converted into a single-element entries array via the generated `virtual:funstack/entries` module. This means there is one unified codepath for rendering and building, reducing maintenance burden and ensuring feature parity.

### Edge Cases and Considerations

#### Duplicate paths
If two entries declare the same `path`, the build should fail with a clear error message listing the conflicting path.

#### Trailing slashes
Entry paths are normalized: `/about` and `/about/` are treated identically and both produce `about/index.html`.

#### Shared defer registry
The defer registry accumulates across all entries. This means deferred components are never rendered more than once, even if multiple entries reference them. The trade-off is higher memory usage (all deferred component data stays in memory until the build pipeline processes it), but this avoids redundant computation and simplifies the architecture. The existing content hashing ensures that identical components produce identical output files regardless of which entry triggered the deferral.

#### Memory usage
Entries are built sequentially (not in parallel). All deferred component data accumulates in the registry across entries and is processed once at the end. For sites with many entries and many deferred components, this could use significant memory. This is acceptable for the initial implementation; if it becomes a problem, a batched approach can be added later.

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
2. **Virtual module**: Replace `virtual:funstack/root` and `virtual:funstack/app` with `virtual:funstack/entries`. Branch in the plugin to generate the appropriate module content based on whether the user specified `root`+`app` or `entries`.
3. **RSC entry**: Rewrite `build()` and `serveHTML()` to load entries from `virtual:funstack/entries` and iterate. Remove direct imports of `virtual:funstack/root` and `virtual:funstack/app`.
4. **Build pipeline**: Rewrite `buildApp()` to process the entries array and the shared defer registry. Extract deferred component processing into a separate pass that runs once after all entries.
5. **Dev server**: Update `serveHTML()` to accept a `Request` and match the path against entries.
6. **Preview server**: Serve the correct HTML file by path.
7. **Tests**: Unit tests for path normalization and duplicate detection. E2E test with a multi-entry fixture.
8. **Documentation**: Update README and docs site with the new option.

# Design: Multiple Entries

## Summary

Add support for multiple entry points so that a single project can produce multiple HTML pages at build time. Instead of the current single `root`+`app` pair, users can specify an `entries` option that exports a function returning an array of entry definitions. Each entry produces its own HTML file, RSC payload, and deferred component set.

This is aimed at SSG (Static Site Generation) use cases where a site has multiple distinct pages (e.g. `index.html`, `about.html`, `blog/post-1.html`) that should each be pre-rendered to their own HTML file.

## Current Architecture

Today the plugin accepts a single entry point pair:

```ts
funstackStatic({
  root: "./src/root.tsx", // HTML shell (<html>...</html>)
  app: "./src/App.tsx", // Application content
});
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
});

// Option B: multiple entries (new)
funstackStatic({
  entries: "./src/entries.tsx",
});
```

The `entries` module is a meta-entry point. It exports a function that returns entry definitions. The simplest form returns an array:

```ts
// src/entries.tsx
import type { EntryDefinition } from "@funstack/static/entries";
import Root from "./root";

export default function getEntries(): EntryDefinition[] {
  return [
    {
      path: "index.html",
      root: () => import("./root"),
      app: () => import("./pages/Home"),
    },
    {
      path: "about.html",
      root: { default: Root }, // sync is fine too
      app: () => import("./pages/About"),
    },
  ];
}
```

For large sites, an async generator can be used to stream entries without building the full array in memory:

```ts
// src/entries.tsx
import Root from "./root";
import { readdir } from "node:fs/promises";

export default async function* getEntries() {
  yield {
    path: "index.html",
    root: { default: Root },
    app: <TopPage />,
  };
  // Generate blog pages from filesystem
  for (const slug of await readdir("./content/blog")) {
    const content = await loadMarkdown(`./content/blog/${slug}`);
    yield {
      path: `blog/${slug.replace(/\.md$/, ".html")}`,
      root: { default: Root },
      app: <BlogPost content={content} />,
    };
  }
}
```

#### `EntryDefinition`

```ts
type MaybePromise<T> = T | Promise<T>;

type RootModule = {
  default: React.ComponentType<{ children: React.ReactNode }>;
};
type AppModule = { default: React.ComponentType };

export interface EntryDefinition {
  /**
   * Output file path relative to the build output directory.
   * Must end with ".html".
   * Examples:
   *   "index.html"
   *   "about.html"
   *   "blog/post-1.html"
   *   "blog/post-1/index.html"
   */
  path: string;
  /**
   * Root component module.
   * Can be a lazy import or a synchronous module object.
   * The module must have a `default` export of a React component.
   */
  root: MaybePromise<RootModule> | (() => MaybePromise<RootModule>);
  /**
   * App content for this entry.
   * Can be:
   * - A module (sync or lazy) with a `default` export component.
   * - A React node (JSX of a server component) for direct rendering.
   */
  app:
    | React.ReactNode
    | MaybePromise<AppModule>
    | (() => MaybePromise<AppModule>);
}

/**
 * Return type of the getEntries function.
 */
type GetEntriesResult =
  | Iterable<EntryDefinition>
  | AsyncIterable<EntryDefinition>;
```

**Design rationale:**

- **`path` as file name**: The user specifies the exact output file path (e.g. `about.html`), giving full control over the output structure. No implicit `path → directory/index.html` conversion — what you write is what you get. The dev server handles the reverse mapping from URL paths to file names.
- **Permissive `root` and `app`**: While lazy imports (`() => import(...)`) are recommended to keep memory usage low, synchronous values are equally valid. This avoids forcing users into unnecessary ceremony for simple cases like sharing a single Root component across entries.
- **`app` accepts `ReactNode`**: This allows passing server component JSX directly (e.g. `<BlogPost content={content} />`), which is more natural for SSG where each entry is parameterized with different data. No need to create a separate module file for each page.
- **`AsyncIterable` return type**: Supports async generators, enabling streaming entry generation from external data sources (filesystem, CMS, database) without buffering the full list in memory.
- **Function export**: Gives users the ability to programmatically generate entries. The entries module runs in the RSC environment at build time, so it has access to Node.js APIs.

#### Resolving `root` and `app`

Since `root` and `app` have flexible types, the RSC entry normalizes them before rendering:

```ts
async function resolveRoot(
  root: EntryDefinition["root"],
): Promise<React.ComponentType<{ children: React.ReactNode }>> {
  const module = typeof root === "function" ? await root() : await root;
  return module.default;
}

async function resolveApp(
  app: EntryDefinition["app"],
): Promise<React.ReactNode> {
  if (isAppModule(app)) {
    // Sync module object: { default: Component }
    return React.createElement(app.default);
  }
  if (typeof app === "function") {
    // Lazy import: () => Promise<{ default: Component }>
    const module = await app();
    return React.createElement(module.default);
  }
  if (app instanceof Promise) {
    // Promise<{ default: Component }>
    const module = await app;
    return React.createElement(module.default);
  }
  // ReactNode (JSX of a server component)
  return app;
}
```

The `isAppModule` helper distinguishes `{ default: Component }` from other objects (React elements). It checks for the presence of a `default` property that is a function.

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
  return [
    {
      path: "index.html",
      root: { default: Root },
      app: { default: App },
    },
  ];
}
```

The existing `virtual:funstack/root` and `virtual:funstack/app` modules are removed. They are no longer needed since entry components are always loaded via the entries module.

#### 2. RSC Entry Changes (`rsc/entry.tsx`)

The existing `build()` function is replaced by a unified `build()` that iterates over all entries. It uses `for await` to support both arrays and async iterables:

```ts
export async function build() {
  const getEntries = (await import("virtual:funstack/entries")).default;

  const ssrEntryModule = await import.meta.viteRsc.loadModule<
    typeof import("../ssr/entry")
  >("ssr");

  const results: EntryBuildResult[] = [];
  for await (const entry of getEntries()) {
    const Root = await resolveRoot(entry.root);
    const appNode = await resolveApp(entry.app);

    const marker = generateAppMarker();

    let rootRscStream: ReadableStream<Uint8Array>;
    let appRscStream: ReadableStream<Uint8Array>;

    if (ssrEnabled) {
      rootRscStream = renderToReadableStream<RscPayload>({
        root: <Root>{appNode}</Root>,
      });
      appRscStream = renderToReadableStream<RscPayload>({
        root: <Root>{appNode}</Root>,
      });
    } else {
      rootRscStream = renderToReadableStream<RscPayload>({
        root: <Root><span id={marker} /></Root>,
      });
      appRscStream = renderToReadableStream<RscPayload>({
        root: appNode,
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

Note that `for await` works on both plain arrays and async iterables, so no branching is needed.

**Key point**: the defer registry is **not** cleared between entries. All deferred components from all entries accumulate in the single global registry. This avoids redundant computation — if multiple entries defer the same component, it is rendered once and shared via content hashing. The registry is returned alongside the per-entry results so that the build pipeline can process all deferred components in one pass.

#### 3. Build Pipeline Changes (`build/buildApp.ts`)

Since single-entry and multi-entry are unified, the build function always receives the same shape from `build()`:

```ts
export async function buildApp(
  builder: ViteBuilder,
  context: MinimalPluginContextWithoutEnvironment,
) {
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

  // entryPath is already a file name (e.g. "index.html", "about.html")
  await writeFileNormal(
    path.join(baseDir, entryPath),
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
2. Map the request URL path to candidate file names and find the matching entry.
3. Resolve the matched entry's root and app.
4. Render and return the HTML.

**URL-to-filename matching**: The dev server maps a URL path to candidate file names using these rules:

- `/` → `index.html`
- `/about` → `about.html`, then `about/index.html`
- `/blog/post-1` → `blog/post-1.html`, then `blog/post-1/index.html`

The first match wins. For single-entry `root`+`app` configs, the synthesized entry has `path: "index.html"`, so all requests to `/` match it. Requests to other paths would get no match (404), which is correct since single-entry mode only produces one page.

For dev, entries can be cached after first load and invalidated on HMR.

#### 5. Preview Server Changes (`plugin/server.ts`)

The preview server currently serves a single `index.html`. With multiple entries, it uses the same URL-to-filename mapping as the dev server to locate the correct HTML file on disk:

```ts
// In preview middleware
if (req.headers.accept?.includes("text/html")) {
  const urlPath = new URL(req.url!, `http://${req.headers.host}`).pathname;
  const candidates = urlPathToFileCandidates(urlPath);
  for (const candidate of candidates) {
    try {
      const html = await readFile(
        path.join(resolvedOutDir, candidate),
        "utf-8",
      );
      res.end(html);
      return;
    } catch {
      // Try next candidate
    }
  }
  // No matching file found — fall through to 404
  next();
  return;
}
```

The `urlPathToFileCandidates` helper is shared between dev and preview servers:

```ts
function urlPathToFileCandidates(urlPath: string): string[] {
  if (urlPath === "/" || urlPath === "") {
    return ["index.html"];
  }
  const stripped = urlPath.replace(/^\//, "").replace(/\/$/, "");
  return [`${stripped}.html`, `${stripped}/index.html`];
}
```

#### 6. Client Entry (`client/entry.tsx`)

No changes needed. Each HTML page already includes its own manifest (`AppClientManifest`) with the correct RSC payload path. The client entry is the same script included in every page — it reads whatever manifest is in the page's `<script>` and hydrates/mounts accordingly.

### Output Structure

Given entries with `path` values `index.html`, `about.html`, and `blog/post-1.html`:

```
dist/public/
├── index.html                                    # path: "index.html"
├── about.html                                    # path: "about.html"
├── blog/
│   └── post-1.html                               # path: "blog/post-1.html"
├── funstack__/
│   └── fun:rsc-payload/
│       ├── a1b2c3d4e5f6g7h8.txt                  # RSC payload for index.html
│       ├── i9j0k1l2m3n4o5p6.txt                  # RSC payload for about.html
│       ├── q7r8s9t0u1v2w3x4.txt                  # RSC payload for blog/post-1.html
│       ├── {hash}.txt                             # deferred components (shared by hash)
│       └── ...
└── assets/
    ├── client.js                                  # Client bundle (shared)
    └── ...
```

All pages share the same client JS bundle. Only the HTML and RSC payloads differ per page. The output file structure mirrors the `path` values exactly — no implicit directory nesting is applied.

### Migration & Backward Compatibility

- The existing `root`+`app` API is fully preserved. No changes to user-facing behavior.
- `entries` mode is purely additive. The single-entry configuration remains the default and recommended approach for single-page apps.
- Internally, `root`+`app` is converted into a single-element entries array via the generated `virtual:funstack/entries` module. This means there is one unified codepath for rendering and building, reducing maintenance burden and ensuring feature parity.

### Edge Cases and Considerations

#### Duplicate paths

If two entries declare the same `path`, the build should fail with a clear error message listing the conflicting path.

#### Path validation

Entry paths must end with `.html`. Paths must not start with `/` (they are relative to the output directory). Invalid paths cause a build error with a clear message.

#### Ambiguous URL matching in dev/preview

A URL path like `/about` produces candidates `about.html` and `about/index.html`. If entries for both exist, the first candidate (`about.html`) wins. This is documented behavior — users should avoid creating both `about.html` and `about/index.html` unless they understand the precedence.

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

1. **Type definitions**: Add `EntryDefinition`, `GetEntriesResult`, `MaybePromise` exports. Update `FunstackStaticOptions` union type.
2. **Virtual module**: Replace `virtual:funstack/root` and `virtual:funstack/app` with `virtual:funstack/entries`. Branch in the plugin to generate the appropriate module content based on whether the user specified `root`+`app` or `entries`.
3. **Entry resolution helpers**: Implement `resolveRoot()`, `resolveApp()`, and `isAppModule()` to normalize the permissive entry types into concrete components/nodes.
4. **RSC entry**: Rewrite `build()` and `serveHTML()` to load entries from `virtual:funstack/entries` and iterate with `for await`. Remove direct imports of `virtual:funstack/root` and `virtual:funstack/app`.
5. **Build pipeline**: Rewrite `buildApp()` to process the entries array and the shared defer registry. Extract deferred component processing into a separate pass that runs once after all entries. Add path validation (must end with `.html`, no leading `/`, no duplicates).
6. **URL-to-filename mapping**: Implement shared `urlPathToFileCandidates()` helper for dev and preview servers.
7. **Dev server**: Update `serveHTML()` to accept a `Request` and match the URL path against entries via filename candidates.
8. **Preview server**: Serve the correct HTML file by trying filename candidates on disk.
9. **Tests**: Unit tests for path validation, URL-to-filename mapping, `resolveRoot`/`resolveApp`. E2E test with a multi-entry fixture.
10. **Documentation**: Update README and docs site with the new option.

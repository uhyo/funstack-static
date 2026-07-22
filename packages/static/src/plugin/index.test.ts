import { describe, it, expect } from "vitest";
import type { Plugin } from "vite";
import funstackStatic, { type FunstackStaticOptions } from "./index";

/**
 * Extract the `@funstack/static:config` plugin, which owns the
 * `configEnvironment` hook that tweaks `optimizeDeps`.
 */
function getConfigPlugin(options: FunstackStaticOptions): Plugin {
  const plugin = funstackStatic(options)
    .flat()
    .find((p): p is Plugin => p.name === "@funstack/static:config");
  if (!plugin) {
    throw new Error("config plugin not found");
  }
  return plugin;
}

/**
 * Run the `configEnvironment` hook for the given environment and return the
 * mutated `optimizeDeps` config.
 */
function runConfigEnvironment(
  options: FunstackStaticOptions,
  name: string,
): { include: string[]; exclude: string[] } {
  const plugin = getConfigPlugin(options);
  const hook = plugin.configEnvironment;
  const handler = typeof hook === "function" ? hook : hook?.handler;
  if (!handler) {
    throw new Error("configEnvironment hook not found");
  }
  const config: { optimizeDeps?: { include?: string[]; exclude?: string[] } } =
    {};
  // The hook only reads `name` and mutates `config.optimizeDeps`; the third
  // `ConfigEnv` argument is unused, so an empty object is sufficient.
  handler.call({} as never, name, config as never, {} as never);
  return {
    include: config.optimizeDeps?.include ?? [],
    exclude: config.optimizeDeps?.exclude ?? [],
  };
}

const fsRoutesOptions: FunstackStaticOptions = {
  fsRoutes: {
    dir: "./src/pages",
    root: "./src/root.tsx",
    adapter: "@funstack/static/fs-routes/next-adapter",
  },
};

/**
 * Find a plugin by name in the flattened plugin list.
 */
function getPlugin(plugins: (Plugin | Plugin[])[], name: string): Plugin {
  const plugin = plugins.flat().find((p): p is Plugin => p.name === name);
  if (!plugin) {
    throw new Error(`${name} plugin not found`);
  }
  return plugin;
}

/**
 * Run `configResolved` (with the given Vite root) followed by `load(id)` on
 * the virtual-entry plugin, returning the generated module code.
 */
function loadVirtualModule(
  options: FunstackStaticOptions,
  viteRoot: string,
  id: string,
): string {
  const plugins = funstackStatic(options);
  const configPlugin = getPlugin(plugins, "@funstack/static:config");
  const configResolved = configPlugin.configResolved;
  const configResolvedHandler =
    typeof configResolved === "function"
      ? configResolved
      : configResolved?.handler;
  if (!configResolvedHandler) {
    throw new Error("configResolved hook not found");
  }
  // The hook only reads `config.root`.
  configResolvedHandler.call({} as never, { root: viteRoot } as never);

  const virtualPlugin = getPlugin(plugins, "@funstack/static:virtual-entry");
  const load = virtualPlugin.load;
  const loadHandler = typeof load === "function" ? load : load?.handler;
  if (!loadHandler) {
    throw new Error("load hook not found");
  }
  const code = loadHandler.call({} as never, id, undefined);
  if (typeof code !== "string") {
    throw new Error(`load did not return code for ${id}`);
  }
  return code;
}

describe("virtual module path escaping", () => {
  // A Vite root whose path needs escaping when embedded in a JS string
  // literal. Such paths must not produce syntax errors (or injected code) in
  // the generated virtual modules (#149).
  const trickyRoot = '/pro"ject';

  it("escapes root and app paths in the single-entry entries module", () => {
    const code = loadVirtualModule(
      { root: "./src/root.tsx", app: "./src/App.tsx" },
      trickyRoot,
      "\0virtual:funstack/entries",
    );
    expect(code).toContain('import Root from "/pro\\"ject/src/root.tsx";');
    expect(code).toContain('import App from "/pro\\"ject/src/App.tsx";');
  });

  it("escapes the entries module path in multi-entry mode", () => {
    const code = loadVirtualModule(
      { entries: "./src/entries.tsx" },
      trickyRoot,
      "\0virtual:funstack/entries",
    );
    expect(code).toBe('export { default } from "/pro\\"ject/src/entries.tsx";');
  });

  it("escapes root and adapter paths in the fsRoutes entries module", () => {
    const code = loadVirtualModule(
      {
        fsRoutes: {
          dir: "./src/pages",
          root: "./src/root.tsx",
          adapter: "./src/adapter.ts",
        },
      },
      trickyRoot,
      "\0virtual:funstack/entries",
    );
    expect(code).toContain('import Root from "/pro\\"ject/src/root.tsx";');
    expect(code).toContain('import adapter from "/pro\\"ject/src/adapter.ts";');
  });

  it("escapes the clientInit path in the client-init module", () => {
    const code = loadVirtualModule(
      {
        root: "./src/root.tsx",
        app: "./src/App.tsx",
        clientInit: "./src/init.ts",
      },
      trickyRoot,
      "\0virtual:funstack/client-init",
    );
    expect(code).toBe('import "/pro\\"ject/src/init.ts";');
  });

  it("escapes the build entry path in the build-entry module", () => {
    const code = loadVirtualModule(
      {
        root: "./src/root.tsx",
        app: "./src/App.tsx",
        build: "./src/build.ts",
      },
      trickyRoot,
      "\0virtual:funstack/build-entry",
    );
    expect(code).toBe('export { default } from "/pro\\"ject/src/build.ts";');
  });
});

describe("configEnvironment optimizeDeps", () => {
  it("includes React and ReactDOM as a single (bare) optimized chunk", () => {
    const { include, exclude } = runConfigEnvironment(
      fsRoutesOptions,
      "client",
    );
    // Bare specifiers (not the nested `@funstack/static > react` form) so React
    // merges with the copy the optimizer scanner already discovers — one chunk,
    // no duplicate-React flip on a cold-started dev server (#128).
    expect(include).toContain("react");
    expect(include).toContain("react-dom");
    expect(include).not.toContain("@funstack/static > react");
    expect(include).not.toContain("@funstack/static > react-dom");
    expect(exclude).toContain("@funstack/static");
  });

  it("pre-bundles client packages (react peer dependency) in the client environment", () => {
    // The detection runs against this package, whose own devDependencies
    // include @funstack/router (a `react` peer-dependency client package).
    // Pre-bundling such packages avoids a cold-start re-optimization that would
    // corrupt CJS-interop module references (#124, #128).
    const { include } = runConfigEnvironment(fsRoutesOptions, "client");
    expect(include).toContain("@funstack/router");
  });

  it("only pre-bundles client packages in the client environment", () => {
    for (const name of ["rsc", "ssr"]) {
      const { include } = runConfigEnvironment(fsRoutesOptions, name);
      expect(include).not.toContain("@funstack/router");
    }
  });
});

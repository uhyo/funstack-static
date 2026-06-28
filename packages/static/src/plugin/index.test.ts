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

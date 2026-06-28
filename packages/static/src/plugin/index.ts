import path from "node:path";
import { normalizePath, type Plugin } from "vite";
import rsc from "@vitejs/plugin-rsc";
import { buildApp } from "../build/buildApp";
import { serverPlugin } from "./server";
import { defaultRscPayloadDir } from "../rsc/rscModule";

interface FunstackStaticBaseOptions {
  /**
   * Output directory for build.
   *
   * @default dist/public
   */
  publicOutDir?: string;
  /**
   * Enable server-side rendering of the App component.
   * When false, only the Root shell is SSR'd and the App renders client-side.
   * When true, both Root and App are SSR'd and the client hydrates.
   *
   * @default false
   */
  ssr?: boolean;
  /**
   * Path to a module that runs on the client side before React hydration.
   * Use this for client-side instrumentation like Sentry, analytics, or feature flags.
   * The module is imported for its side effects only (no exports needed).
   */
  clientInit?: string;
  /**
   * Directory name used for RSC payload files in the build output.
   * The final path will be `/funstack__/{rscPayloadDir}/{hash}.txt`.
   *
   * Change this if your hosting platform has issues with the default
   * directory name.
   *
   * The value is used as a marker for string replacement during the build
   * process, so it should be unique enough that it does not appear in your
   * application's source code.
   *
   * @default "fun__rsc-payload"
   */
  rscPayloadDir?: string;
  /**
   * Path to a module that customizes the build process.
   * The module should `export default` an async function that receives
   * `{ build }` where `build` is a function that performs the default
   * build flow.
   *
   * This allows you to run additional work before/after the build,
   * or to control the build execution (e.g. parallel work).
   * Only called during production builds, not in dev mode.
   *
   * The module runs in the RSC environment.
   */
  build?: string;
}

interface SingleEntryOptions {
  /**
   * Root component of the page.
   * The file should `export default` a React component that renders the whole page.
   * (`<html>...</html>`).
   */
  root: string;
  /**
   * Entry point of your application.
   * The file should `export default` a React component that renders the application content.
   */
  app: string;
  entries?: never;
  fsRoutes?: never;
}

interface MultipleEntriesOptions {
  root?: never;
  app?: never;
  /**
   * Path to a module that exports a function returning entry definitions.
   * Mutually exclusive with `root`+`app`.
   */
  entries: string;
  fsRoutes?: never;
}

/**
 * Options for built-in file-system based routing.
 *
 * Pages discovered in `dir` are mapped to routes via an adapter (which defines
 * the directory / file-name convention) and rendered through FUNSTACK Router.
 * Using this feature requires `@funstack/router` to be installed.
 *
 * @experimental File-system routing is experimental and not yet subject to
 * semantic versioning.
 */
export interface FsRoutesConfig {
  /**
   * Directory containing route files, relative to the Vite root.
   *
   * Commonly `"./src/pages"`.
   */
  dir: string;
  /**
   * Path to the root (HTML shell) component module.
   * The file should `export default` a React component that renders the whole
   * page (`<html>...</html>`) and places `children` inside `<body>`.
   */
  root: string;
  /**
   * Module that `export default`s an `FsRoutesAdapter`, which defines the
   * directory / file-name convention. Either a bare module specifier (a package
   * import) or a path to a local module, relative to the Vite root.
   *
   * To use the built-in Next.js-like convention with default options, point
   * this at the bundled module `@funstack/static/fs-routes/next-adapter`.
   * For custom options, `export default nextRoutes(options)` (from
   * `@funstack/static/fs-routes`) in your own module and point this at it.
   */
  adapter: string;
}

interface FsRoutesOptions {
  root?: never;
  app?: never;
  entries?: never;
  /**
   * Enable built-in file-system based routing.
   * Mutually exclusive with `root`+`app` and `entries`.
   *
   * @experimental
   */
  fsRoutes: FsRoutesConfig;
}

export type FunstackStaticOptions = FunstackStaticBaseOptions &
  (SingleEntryOptions | MultipleEntriesOptions | FsRoutesOptions);

/**
 * Whether `id` is a bare module specifier (a package import) rather than a
 * relative or absolute file path. Bare specifiers are passed through to the
 * generated import as-is; paths are resolved against the Vite root.
 */
function isBareSpecifier(id: string): boolean {
  return !id.startsWith(".") && !path.isAbsolute(id);
}

export default function funstackStatic(
  options: FunstackStaticOptions,
): (Plugin | Plugin[])[] {
  const {
    publicOutDir = "dist/public",
    ssr = false,
    clientInit,
    rscPayloadDir = defaultRscPayloadDir,
  } = options;

  // Validate rscPayloadDir to prevent path traversal or invalid segments
  if (
    !rscPayloadDir ||
    rscPayloadDir.includes("/") ||
    rscPayloadDir.includes("\\") ||
    rscPayloadDir === ".." ||
    rscPayloadDir === "."
  ) {
    throw new Error(
      `[funstack] Invalid rscPayloadDir: "${rscPayloadDir}". Must be a non-empty single path segment without slashes.`,
    );
  }

  let resolvedEntriesModule: string = "__uninitialized__";
  let resolvedClientInitEntry: string | undefined;
  let resolvedBuildEntry: string | undefined;
  // Resolved configuration for file-system routing (fsRoutes mode).
  let resolvedFsRoutes:
    | { root: string; adapter: string; globBase: string }
    | undefined;

  // Determine which entry mode the user selected.
  const isFsRoutes = "fsRoutes" in options && options.fsRoutes !== undefined;
  const isMultiEntry =
    !isFsRoutes && "entries" in options && options.entries !== undefined;

  return [
    {
      name: "@funstack/static:config-pre",
      // Placed early because the rsc plugin sets the outDir to the default value
      config(config) {
        return {
          environments: {
            client: {
              build: {
                outDir:
                  config.environments?.client?.build?.outDir ?? publicOutDir,
              },
            },
          },
        };
      },
    },
    serverPlugin(),
    rsc({
      entries: {
        rsc: "@funstack/static/entries/rsc",
        ssr: "@funstack/static/entries/ssr",
        client: "@funstack/static/entries/client",
      },
      serverHandler: false,
    }),
    {
      name: "@funstack/static:config",
      configResolved(config) {
        if (isFsRoutes) {
          const fsRoutes = options.fsRoutes;
          const resolvedRoot = normalizePath(
            path.resolve(config.root, fsRoutes.root),
          );
          const resolvedDir = normalizePath(
            path.resolve(config.root, fsRoutes.dir),
          );
          // Glob patterns in generated virtual modules must be root-relative
          // (a virtual module has no real path to resolve "./" against).
          const relativeDir = normalizePath(
            path.relative(config.root, resolvedDir),
          );
          const globBase = `/${relativeDir.replace(/^\.?\/?/, "").replace(/\/$/, "")}`;
          // The adapter may be a bare module specifier (e.g. the built-in
          // `@funstack/static/fs-routes/next-adapter`) or a path to a local module.
          // Resolve only the latter against the Vite root.
          const adapter = isBareSpecifier(fsRoutes.adapter)
            ? fsRoutes.adapter
            : normalizePath(path.resolve(config.root, fsRoutes.adapter));
          resolvedFsRoutes = { root: resolvedRoot, adapter, globBase };
        } else if (isMultiEntry) {
          resolvedEntriesModule = normalizePath(
            path.resolve(config.root, options.entries),
          );
        } else {
          // For single-entry, we store both resolved paths to generate a
          // synthetic entries module in the virtual module loader.
          const resolvedRoot = normalizePath(
            path.resolve(config.root, options.root),
          );
          const resolvedApp = normalizePath(
            path.resolve(config.root, options.app),
          );
          // Encode as JSON for safe embedding in generated code
          resolvedEntriesModule = JSON.stringify({
            root: resolvedRoot,
            app: resolvedApp,
          });
        }
        if (clientInit) {
          resolvedClientInitEntry = normalizePath(
            path.resolve(config.root, clientInit),
          );
        }
        if (options.build) {
          resolvedBuildEntry = normalizePath(
            path.resolve(config.root, options.build),
          );
        }
      },
      configEnvironment(_name, config) {
        if (!config.optimizeDeps) {
          config.optimizeDeps = {};
        }
        config.optimizeDeps.include ??= [];
        // Needed for properly bundling @vitejs/plugin-rsc for browser.
        // See: https://github.com/vitejs/vite-plugin-react/tree/79bf57cc8b9c77e33970ec2e876bd6d2f1568d5d/packages/plugin-rsc#using-vitejsplugin-rsc-as-a-framework-packages-dependencies
        config.optimizeDeps.include = config.optimizeDeps.include.map(
          (entry) => {
            if (entry.startsWith("@vitejs/plugin-rsc")) {
              entry = `@funstack/static > ${entry}`;
            }
            return entry;
          },
        );
        config.optimizeDeps.exclude ??= [];
        // Since code includes imports to virtual modules, we need to exclude
        // us from Optimize Deps.
        config.optimizeDeps.exclude.push("@funstack/static");
        // However, since Vite prohibits excluding a CommonJS package,
        // we need to include React and ReactDOM so they are bundled properly.
        config.optimizeDeps.include.push(
          "@funstack/static > react",
          "@funstack/static > react-dom",
        );
      },
    },
    {
      name: "@funstack/static:virtual-entry",
      resolveId(id) {
        if (id === "virtual:funstack/entries") {
          return "\0virtual:funstack/entries";
        }
        if (id === "virtual:funstack/config") {
          return "\0virtual:funstack/config";
        }
        if (id === "virtual:funstack/client-init") {
          return "\0virtual:funstack/client-init";
        }
        if (id === "virtual:funstack/build-entry") {
          return "\0virtual:funstack/build-entry";
        }
      },
      load(id) {
        if (id === "\0virtual:funstack/entries") {
          if (isFsRoutes && resolvedFsRoutes) {
            // Synthesize a getEntries module from file-system routing config.
            // The import.meta.glob call is emitted here so users don't have to
            // wire it up themselves; Vite transforms the glob in this virtual
            // module just like in user code.
            const { root, adapter, globBase } = resolvedFsRoutes;
            const globPattern = `${globBase}/**/*.{tsx,jsx}`;
            const lines = [
              `import Root from "${root}";`,
              `import adapter from "${adapter}";`,
              `import { createFsRoutesEntries } from "@funstack/static/fs-routes";`,
              `const modules = import.meta.glob(${JSON.stringify(globPattern)}, { eager: true });`,
              `export default createFsRoutesEntries({`,
              `  modules,`,
              `  root: Root,`,
              `  adapter,`,
              `});`,
            ];
            return lines.join("\n");
          }
          if (isMultiEntry) {
            // Re-export the user's entries module
            return `export { default } from "${resolvedEntriesModule}";`;
          }
          // Synthesize a single-entry array from root+app
          const { root, app } = JSON.parse(resolvedEntriesModule);
          return [
            `import Root from "${root}";`,
            `import App from "${app}";`,
            `export default function getEntries() {`,
            `  return [{ path: "index.html", root: { default: Root }, app: { default: App } }];`,
            `}`,
          ].join("\n");
        }
        if (id === "\0virtual:funstack/config") {
          return [
            `export const ssr = ${JSON.stringify(ssr)};`,
            `export const rscPayloadDir = ${JSON.stringify(rscPayloadDir)};`,
          ].join("\n");
        }
        if (id === "\0virtual:funstack/client-init") {
          if (resolvedClientInitEntry) {
            return `import "${resolvedClientInitEntry}";`;
          }
          return "";
        }
        if (id === "\0virtual:funstack/build-entry") {
          if (resolvedBuildEntry) {
            return `export { default } from "${resolvedBuildEntry}";`;
          }
          return "export default undefined;";
        }
      },
    },
    {
      name: "@funstack/static:build",
      async buildApp(builder) {
        await buildApp(builder, this, { rscPayloadDir });
      },
    },
  ];
}

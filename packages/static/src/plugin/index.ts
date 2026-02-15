import path from "node:path";
import type { Plugin } from "vite";
import rsc from "@vitejs/plugin-rsc";
import { buildApp } from "../build/buildApp";
import { serverPlugin } from "./server";

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
}

interface MultipleEntriesOptions {
  root?: never;
  app?: never;
  /**
   * Path to a module that exports a function returning entry definitions.
   * Mutually exclusive with `root`+`app`.
   */
  entries: string;
}

export type FunstackStaticOptions = FunstackStaticBaseOptions &
  (SingleEntryOptions | MultipleEntriesOptions);

export default function funstackStatic(
  options: FunstackStaticOptions,
): (Plugin | Plugin[])[] {
  const { publicOutDir = "dist/public", ssr = false, clientInit } = options;

  let resolvedEntriesModule: string = "__uninitialized__";
  let resolvedClientInitEntry: string | undefined;

  // Determine whether user specified entries or root+app
  const isMultiEntry = "entries" in options && options.entries !== undefined;

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
        if (isMultiEntry) {
          resolvedEntriesModule = path.resolve(config.root, options.entries);
        } else {
          // For single-entry, we store both resolved paths to generate a
          // synthetic entries module in the virtual module loader.
          const resolvedRoot = path.resolve(config.root, options.root);
          const resolvedApp = path.resolve(config.root, options.app);
          // Encode as JSON for safe embedding in generated code
          resolvedEntriesModule = JSON.stringify({
            root: resolvedRoot,
            app: resolvedApp,
          });
        }
        if (clientInit) {
          resolvedClientInitEntry = path.resolve(config.root, clientInit);
        }
      },
      configEnvironment(_name, config) {
        if (!config.optimizeDeps) {
          config.optimizeDeps = {};
        }
        // Needed for properly bundling @vitejs/plugin-rsc for browser.
        // See: https://github.com/vitejs/vite-plugin-react/tree/79bf57cc8b9c77e33970ec2e876bd6d2f1568d5d/packages/plugin-rsc#using-vitejsplugin-rsc-as-a-framework-packages-dependencies
        if (config.optimizeDeps.include) {
          config.optimizeDeps.include = config.optimizeDeps.include.map(
            (entry) => {
              if (entry.startsWith("@vitejs/plugin-rsc")) {
                entry = `@funstack/static > ${entry}`;
              }
              return entry;
            },
          );
        }
        if (!config.optimizeDeps.exclude) {
          config.optimizeDeps.exclude = [];
        }
        // Since code includes imports to virtual modules, we need to exclude
        // us from Optimize Deps.
        config.optimizeDeps.exclude.push("@funstack/static");
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
      },
      load(id) {
        if (id === "\0virtual:funstack/entries") {
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
          return `export const ssr = ${JSON.stringify(ssr)};`;
        }
        if (id === "\0virtual:funstack/client-init") {
          if (resolvedClientInitEntry) {
            return `import "${resolvedClientInitEntry}";`;
          }
          return "";
        }
      },
    },
    {
      name: "@funstack/static:build",
      async buildApp(builder) {
        await buildApp(builder, this);
      },
    },
  ];
}

import path from "node:path";
import type { Plugin } from "vite";
import rsc from "@vitejs/plugin-rsc";
import { buildApp } from "../build/buildApp";
import { serverPlugin } from "./server";

export interface FunstackStaticOptions {
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
}

export default function funstackStatic({
  root,
  app,
  publicOutDir = "dist/public",
  ssr = false,
}: FunstackStaticOptions): (Plugin | Plugin[])[] {
  let resolvedRootEntry: string = "__uninitialized__";
  let resolvedAppEntry: string = "__uninitialized__";

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
        resolvedRootEntry = path.resolve(config.root, root);
        resolvedAppEntry = path.resolve(config.root, app);
      },
      // Needed for properly bundling @vitejs/plugin-rsc for browser.
      // See: https://github.com/vitejs/vite-plugin-react/tree/79bf57cc8b9c77e33970ec2e876bd6d2f1568d5d/packages/plugin-rsc#using-vitejsplugin-rsc-as-a-framework-packages-dependencies
      configEnvironment(_name, config) {
        if (config.optimizeDeps?.include) {
          config.optimizeDeps.include = config.optimizeDeps.include.map(
            (entry) => {
              if (entry.startsWith("@vitejs/plugin-rsc")) {
                entry = `@funstack/static > ${entry}`;
              }
              return entry;
            },
          );
        }
      },
    },
    {
      name: "@funstack/static:virtual-entry",
      resolveId(id) {
        if (id === "virtual:funstack/root") {
          return "\0virtual:funstack/root";
        }
        if (id === "virtual:funstack/app") {
          return "\0virtual:funstack/app";
        }
        if (id === "virtual:funstack/config") {
          return "\0virtual:funstack/config";
        }
      },
      load(id) {
        if (id === "\0virtual:funstack/root") {
          return `export { default } from "${resolvedRootEntry}";`;
        }
        if (id === "\0virtual:funstack/app") {
          return `export { default } from "${resolvedAppEntry}";`;
        }
        if (id === "\0virtual:funstack/config") {
          return `export const ssr = ${JSON.stringify(ssr)};`;
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

import funstackStatic from "@funstack/static";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * This fixture does not install the optional `@funstack/router` peer
 * dependency (#203). Inside this workspace, though, `@funstack/static` is
 * symlinked and would still find the router in its own devDependencies, so
 * make it unresolvable the way it is in an app that never installed it.
 */
function withoutFunstackRouter(): Plugin {
  return {
    name: "e2e:without-funstack-router",
    enforce: "pre",
    resolveId(id) {
      if (id === "@funstack/router" || id.startsWith("@funstack/router/")) {
        this.error(
          `"${id}" is not installed in this fixture. Apps that don't use file-system routing must work without it.`,
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [
    withoutFunstackRouter(),
    funstackStatic({
      root: "./src/root.tsx",
      app: "./src/App.tsx",
      ssr: true,
    }),
    react(),
  ],
});

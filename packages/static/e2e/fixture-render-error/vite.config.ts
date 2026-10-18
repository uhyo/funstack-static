import funstackStatic from "@funstack/static";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Which App to build and the plugin options are selected by environment
// variables, so that e2e/tests/render-error.spec.ts can build each case.
const scenario = process.env.RENDER_ERROR_SCENARIO ?? "ok";
const ssr = process.env.RENDER_ERROR_SSR === "true";
const failOnRenderError = process.env.RENDER_ERROR_FAIL !== "false";

// Separate output per variant so that builds can run in parallel.
const outDir = `dist/${scenario}-${ssr ? "ssr" : "csr"}${failOnRenderError ? "" : "-nofail"}`;

export default defineConfig({
  plugins: [
    funstackStatic({
      root: "./src/root.tsx",
      app: `./src/scenarios/${scenario}.tsx`,
      ssr,
      failOnRenderError,
      publicOutDir: `${outDir}/public`,
    }),
    react(),
  ],
  environments: {
    rsc: { build: { outDir: `${outDir}/rsc` } },
    ssr: { build: { outDir: `${outDir}/ssr` } },
  },
});

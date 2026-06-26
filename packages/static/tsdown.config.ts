import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/entryDefinition.ts",
    "src/entries/*.ts",
    "src/bin/*.ts",
    "src/fs-routes/index.ts",
    "src/fs-routes/next-adapter.ts",
  ],
  // Vite virtual modules & subpath imports
  external: [/^virtual:/, /^#/],
  format: ["esm"],
  dts: true,
  unbundle: true,
});

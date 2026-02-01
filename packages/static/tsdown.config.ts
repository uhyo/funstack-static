import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/entries/*.ts", "src/bin/*.ts"],
  // Vite virtual modules & subpath imports
  external: [/^virtual:/, /^#/],
  format: ["esm"],
  dts: true,
  unbundle: true,
});

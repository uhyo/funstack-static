import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/entries/*.ts"],
  format: ["esm"],
  dts: true,
  unbundle: true,
});

#! /usr/bin/env node

import { install } from "@funstack/skill-installer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Resolve relative to this script (dist/bin/) so it works
// both when installed locally and via npx -p / pnpm dlx / yarn dlx.
const resolved = path.resolve(
  __dirname,
  "../../skills/funstack-static-knowledge",
);

console.log("Installing skill from:", resolved);

await install(resolved);

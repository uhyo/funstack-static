#! /usr/bin/env node

import { install } from "@funstack/skill-installer";
import path from "node:path";

const skillDir =
  "./node_modules/@funstack/static/skills/funstack-static-knowledge";

const resolved = path.resolve(skillDir);

console.log("Installing skill from:", resolved);

await install(resolved);

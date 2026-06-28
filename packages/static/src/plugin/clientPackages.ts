import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Discover the project's "client packages": directly-declared dependencies that
 * list `react` as a peer dependency.
 *
 * `@vitejs/plugin-rsc` treats exactly these (a `react` peer dependency) as
 * framework packages. When a server component imports one, the package is
 * reached on the browser through a runtime-generated `client-package-proxy`
 * virtual module that the dependency optimizer's initial scan cannot follow, so
 * the package — and the copy of React it pulls in — is otherwise only
 * discovered at request time. That late discovery triggers a re-optimization
 * pass which leaves a second copy of React loaded on the first cold-start
 * render, breaking hooks with an "Invalid hook call" error before Vite reloads
 * the page (#128). Pre-bundling these packages in the browser environment keeps
 * React deduplicated to a single optimized chunk from the first request.
 *
 * Only directly-declared dependencies are considered: those are the bare
 * specifiers a server component can import (and that Vite can resolve from the
 * project root), whereas a framework package nested inside another dependency
 * is pre-bundled together with its parent. `@funstack/static` and `react-dom`
 * are skipped — `@funstack/static` is excluded from optimizeDeps (it imports
 * virtual modules), and `react-dom` is handled separately.
 */
export function findClientPackages(root: string): string[] {
  let rootPkg: Record<string, unknown>;
  try {
    rootPkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf-8"),
    );
  } catch {
    return [];
  }
  const declared = new Set<string>();
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
  ]) {
    const deps = rootPkg[field];
    if (deps && typeof deps === "object") {
      for (const name of Object.keys(deps)) {
        declared.add(name);
      }
    }
  }
  const require = createRequire(path.join(root, "package.json"));
  const clientPackages: string[] = [];
  for (const name of declared) {
    if (name === "@funstack/static" || name === "react-dom") {
      continue;
    }
    const pkgJson = readDependencyPackageJson(require, root, name);
    const peerDependencies = pkgJson?.["peerDependencies"];
    if (
      peerDependencies &&
      typeof peerDependencies === "object" &&
      "react" in peerDependencies
    ) {
      clientPackages.push(name);
    }
  }
  return clientPackages;
}

/**
 * Read a dependency's `package.json`. Prefers Node resolution (handles pnpm and
 * other layouts), falling back to a direct `node_modules` read for packages
 * that do not expose `./package.json` via their `exports` map.
 */
function readDependencyPackageJson(
  require: NodeJS.Require,
  root: string,
  name: string,
): Record<string, unknown> | undefined {
  for (const candidate of [
    () => require.resolve(`${name}/package.json`),
    () => path.join(root, "node_modules", name, "package.json"),
  ]) {
    try {
      return JSON.parse(fs.readFileSync(candidate(), "utf-8"));
    } catch {
      // Try the next resolution strategy.
    }
  }
  return undefined;
}

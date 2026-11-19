import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = path.resolve(import.meta.dirname, "..");

/**
 * Collects the bare (package) specifiers reachable through static imports
 * and re-exports from `entry`, following relative imports within `src/`.
 */
function collectPackageImports(entry: string): Set<string> {
  const packages = new Set<string>();
  const visited = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const code = fs.readFileSync(file, "utf-8");
    for (const match of code.matchAll(
      /^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm,
    )) {
      const specifier = match[1] ?? match[2]!;
      if (!specifier.startsWith(".")) {
        packages.add(specifier);
        continue;
      }
      const base = path.resolve(path.dirname(file), specifier);
      const resolved = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]
        .map((ext) => base + ext)
        .find((candidate) =>
          fs.statSync(candidate, { throwIfNoEntry: false })?.isFile(),
        );
      if (resolved === undefined) {
        throw new Error(`Cannot resolve ${specifier} from ${file}`);
      }
      queue.push(resolved);
    }
  }
  return packages;
}

describe("#rsc-client entry", () => {
  // `#rsc-client` is loaded by every app (dev server and build), so it must
  // not depend on the optional `@funstack/router` peer dependency (#203).
  it("does not import @funstack/router", () => {
    const packages = collectPackageImports(
      path.join(srcDir, "entries/rsc-client.ts"),
    );
    expect(packages.has("react")).toBe(true);
    expect(
      [...packages].filter((p) => p.startsWith("@funstack/router")),
    ).toEqual([]);
  });
});

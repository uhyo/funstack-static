import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findClientPackages } from "./clientPackages";

/**
 * Build a throwaway project on disk: a root `package.json` plus a
 * `node_modules/<name>/package.json` for each dependency, so `findClientPackages`
 * can resolve and inspect them like a real install.
 */
function makeProject(
  root: string,
  rootPkg: Record<string, unknown>,
  deps: Record<string, Record<string, unknown>>,
): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "test-project", ...rootPkg }),
  );
  for (const [name, pkgJson] of Object.entries(deps)) {
    const dir = path.join(root, "node_modules", name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name, version: "1.0.0", ...pkgJson }),
    );
  }
}

const reactPeer = { peerDependencies: { react: "^19.0.0" } };

describe("findClientPackages", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "funstack-clientpkgs-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("detects dependencies that declare react as a peer dependency", () => {
    makeProject(
      root,
      { dependencies: { "ui-kit": "^1.0.0", lodash: "^4.0.0" } },
      { "ui-kit": reactPeer, lodash: {} },
    );
    expect(findClientPackages(root)).toEqual(["ui-kit"]);
  });

  it("considers devDependencies and optionalDependencies", () => {
    makeProject(
      root,
      {
        devDependencies: { "dev-widget": "^1.0.0" },
        optionalDependencies: { "opt-widget": "^1.0.0" },
      },
      { "dev-widget": reactPeer, "opt-widget": reactPeer },
    );
    expect(findClientPackages(root).sort()).toEqual([
      "dev-widget",
      "opt-widget",
    ]);
  });

  it("skips @funstack/static and react-dom even with a react peer dependency", () => {
    makeProject(
      root,
      {
        dependencies: {
          "@funstack/static": "^1.0.0",
          "react-dom": "^19.0.0",
          "@funstack/router": "^1.0.0",
        },
      },
      {
        "@funstack/static": reactPeer,
        "react-dom": reactPeer,
        "@funstack/router": reactPeer,
      },
    );
    expect(findClientPackages(root)).toEqual(["@funstack/router"]);
  });

  it("ignores transitive dependencies (only direct ones are scanned)", () => {
    // `ui-kit` is a direct dep; `nested-widget` is only present in
    // node_modules (a transitive dep) and must not be returned.
    makeProject(
      root,
      { dependencies: { "ui-kit": "^1.0.0" } },
      { "ui-kit": reactPeer, "nested-widget": reactPeer },
    );
    expect(findClientPackages(root)).toEqual(["ui-kit"]);
  });

  it("skips declared dependencies that are not installed", () => {
    makeProject(root, { dependencies: { "missing-pkg": "^1.0.0" } }, {});
    expect(findClientPackages(root)).toEqual([]);
  });

  it("returns an empty list when there is no package.json", () => {
    expect(findClientPackages(path.join(root, "does-not-exist"))).toEqual([]);
  });
});

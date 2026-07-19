import { describe, expect, it, vi } from "vitest";
import {
  collectStaticPaths,
  modulesToRouteFiles,
  urlPathToFilePath,
} from "./tree";
import type { FsRouteModule, FsRouteTreeNode } from "./types";

const component: FsRouteModule = { default: () => null };

function pageModule(
  generateStaticParams?: FsRouteModule["generateStaticParams"],
): FsRouteModule {
  return { default: () => null, generateStaticParams };
}

describe("collectStaticPaths", () => {
  it("collects static pages, including index pages under a layout", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: undefined,
        page: false,
        module: component,
        children: [
          { path: "/", page: true, module: component },
          { path: "/about", page: true, module: component },
        ],
      },
    ];
    const pages = await collectStaticPaths(tree);
    expect(pages).toEqual([
      { urlPath: "/", params: {} },
      { urlPath: "/about", params: {} },
    ]);
  });

  it("accumulates the path of a nested layout for its children", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/dashboard",
        page: false,
        module: component,
        children: [
          { path: "/", page: true, module: component },
          { path: "/settings", page: true, module: component },
        ],
      },
    ];
    const pages = await collectStaticPaths(tree);
    expect(pages.map((p) => p.urlPath)).toEqual([
      "/dashboard",
      "/dashboard/settings",
    ]);
  });

  it("expands a dynamic route via generateStaticParams", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/blog/:slug",
        page: true,
        module: pageModule(() => [{ slug: "hello" }, { slug: "world" }]),
      },
    ];
    const pages = await collectStaticPaths(tree);
    expect(pages).toEqual([
      { urlPath: "/blog/hello", params: { slug: "hello" } },
      { urlPath: "/blog/world", params: { slug: "world" } },
    ]);
  });

  it("supports async generateStaticParams", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/u/:id",
        page: true,
        module: pageModule(async () => [{ id: "1" }]),
      },
    ];
    const pages = await collectStaticPaths(tree);
    expect(pages).toEqual([{ urlPath: "/u/1", params: { id: "1" } }]);
  });

  it("substitutes catch-all values that contain slashes", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/docs/:slug*",
        page: true,
        module: pageModule(() => [{ slug: "guide/intro" }]),
      },
    ];
    const pages = await collectStaticPaths(tree);
    expect(pages).toEqual([
      { urlPath: "/docs/guide/intro", params: { slug: "guide/intro" } },
    ]);
  });

  it("throws for a dynamic route without generateStaticParams", async () => {
    const tree: FsRouteTreeNode[] = [
      { path: "/blog/:slug", page: true, module: component },
    ];
    await expect(collectStaticPaths(tree)).rejects.toThrow(
      /"\/blog\/:slug".*generateStaticParams/,
    );
  });

  it("throws when generateStaticParams is missing a param value", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/blog/:slug",
        page: true,
        module: pageModule(() => [{ other: "x" }]),
      },
    ];
    await expect(collectStaticPaths(tree)).rejects.toThrow(/slug/);
  });
});

describe("modulesToRouteFiles", () => {
  const m: FsRouteModule = { default: () => null };

  it("strips the base from every key", () => {
    const files = modulesToRouteFiles(
      {
        "./pages/page.tsx": m,
        "./pages/about/page.tsx": m,
        "./pages/blog/[slug]/page.tsx": m,
      },
      "./pages",
    );
    expect(files.map((f) => f.filePath)).toEqual([
      "page.tsx",
      "about/page.tsx",
      "blog/[slug]/page.tsx",
    ]);
  });

  it("keeps a subdirectory shared by every page", () => {
    const files = modulesToRouteFiles(
      {
        "./pages/blog/page.tsx": m,
        "./pages/blog/post/page.tsx": m,
      },
      "./pages",
    );
    expect(files.map((f) => f.filePath)).toEqual([
      "blog/page.tsx",
      "blog/post/page.tsx",
    ]);
  });

  it("keeps the directory of a single nested page", () => {
    const files = modulesToRouteFiles(
      { "./pages/docs/page.tsx": m },
      "./pages",
    );
    expect(files.map((f) => f.filePath)).toEqual(["docs/page.tsx"]);
  });

  it("strips a root-relative base as emitted by the plugin", () => {
    const files = modulesToRouteFiles(
      {
        "/src/pages/blog/page.tsx": m,
        "/src/pages/blog/post/page.tsx": m,
      },
      "/src/pages",
    );
    expect(files.map((f) => f.filePath)).toEqual([
      "blog/page.tsx",
      "blog/post/page.tsx",
    ]);
  });

  it("matches a base written without the leading ./ of the keys", () => {
    const files = modulesToRouteFiles({ "./pages/docs/page.tsx": m }, "pages");
    expect(files.map((f) => f.filePath)).toEqual(["docs/page.tsx"]);
  });

  it("ignores a trailing slash in base", () => {
    const files = modulesToRouteFiles(
      { "./pages/docs/page.tsx": m },
      "./pages/",
    );
    expect(files.map((f) => f.filePath)).toEqual(["docs/page.tsx"]);
  });

  it("warns when no modules are provided", () => {
    const warn = vi.fn();
    expect(modulesToRouteFiles({}, "./pages", warn)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("throws when base does not prefix every key", () => {
    expect(() =>
      modulesToRouteFiles(
        {
          "./pages/page.tsx": m,
          "./pages/about/page.tsx": m,
        },
        "./routes",
      ),
    ).toThrow(/"\.\/routes".*import\.meta\.glob/);
  });
});

describe("urlPathToFilePath", () => {
  it.each([
    ["/", "index.html"],
    ["", "index.html"],
    ["/about", "about.html"],
    ["/blog/hello", "blog/hello.html"],
    ["/docs/guide/intro", "docs/guide/intro.html"],
  ])("maps %s to %s", (urlPath, expected) => {
    expect(urlPathToFilePath(urlPath)).toBe(expected);
  });
});

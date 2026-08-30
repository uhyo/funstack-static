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

function clientReference(name: string): () => never {
  return Object.defineProperties(
    (): never => {
      throw new Error(
        `Unexpectedly client reference export '${name}' is called on server`,
      );
    },
    { $$typeof: { value: Symbol.for("react.client.reference") } },
  );
}

function clientPageModule(): FsRouteModule {
  return {
    default: clientReference("default"),
    generateStaticParams: clientReference("generateStaticParams"),
  };
}

function withoutChain(
  pages: Awaited<ReturnType<typeof collectStaticPaths>>,
): Array<{ urlPath: string; params: Record<string, string> }> {
  return pages.map(({ urlPath, params }) => ({ urlPath, params }));
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
    expect(withoutChain(pages)).toEqual([
      { urlPath: "/", params: {} },
      { urlPath: "/about", params: {} },
    ]);
  });

  it("records the route node chain of every page, root-first", async () => {
    const page: FsRouteTreeNode = { path: "/", page: true, module: component };
    const layout: FsRouteTreeNode = {
      path: "/dashboard",
      page: false,
      module: component,
      children: [page],
    };
    const pages = await collectStaticPaths([layout]);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.chain).toHaveLength(2);
    expect(pages[0]!.chain[0]).toBe(layout);
    expect(pages[0]!.chain[1]).toBe(page);
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
    expect(withoutChain(pages)).toEqual([
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
    expect(withoutChain(pages)).toEqual([
      { urlPath: "/u/1", params: { id: "1" } },
    ]);
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
    expect(withoutChain(pages)).toEqual([
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

  it("throws when a non-catch-all value contains a slash", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/blog/:slug",
        page: true,
        module: pageModule(() => [{ slug: "a/b" }]),
      },
    ];
    await expect(collectStaticPaths(tree)).rejects.toThrow(/"a\/b".*catch-all/);
  });

  it("throws for an empty param value", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/blog/:slug",
        page: true,
        module: pageModule(() => [{ slug: "" }]),
      },
    ];
    await expect(collectStaticPaths(tree)).rejects.toThrow(/empty value/);
  });

  it("throws for an empty catch-all value, suggesting a parent page", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/docs/:slug*",
        page: true,
        module: pageModule(() => [{ slug: "" }]),
      },
    ];
    await expect(collectStaticPaths(tree)).rejects.toThrow(
      /parent route instead/,
    );
  });

  it("throws for a non-string param value", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/blog/:id",
        page: true,
        module: pageModule(() => [
          { id: 5 } as unknown as Record<string, string>,
        ]),
      },
    ];
    await expect(collectStaticPaths(tree)).rejects.toThrow(
      /returned a number.*"id"/,
    );
  });

  it("throws for a catch-all value with leading, trailing, or repeated slashes", async () => {
    for (const slug of ["/a", "a/", "a//b"]) {
      const tree: FsRouteTreeNode[] = [
        {
          path: "/docs/:slug*",
          page: true,
          module: pageModule(() => [{ slug }]),
        },
      ];
      await expect(collectStaticPaths(tree)).rejects.toThrow(/slashes/);
    }
  });

  it('throws for param values containing "." or ".." segments', async () => {
    for (const slug of ["..", ".", "a/../b"]) {
      const tree: FsRouteTreeNode[] = [
        {
          path: "/docs/:slug*",
          page: true,
          module: pageModule(() => [{ slug }]),
        },
      ];
      await expect(collectStaticPaths(tree)).rejects.toThrow(/"\."/);
    }
  });

  it('throws for param values containing "?" or "#"', async () => {
    for (const slug of ["a?b", "a#b"]) {
      const tree: FsRouteTreeNode[] = [
        {
          path: "/blog/:slug",
          page: true,
          module: pageModule(() => [{ slug }]),
        },
      ];
      await expect(collectStaticPaths(tree)).rejects.toThrow(/URL path/);
    }
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

  it("dedupes duplicate params returned by generateStaticParams", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/blog/:slug",
        page: true,
        module: pageModule(() => [
          { slug: "hello" },
          { slug: "hello" },
          { slug: "world" },
        ]),
      },
    ];
    const pages = await collectStaticPaths(tree);
    expect(withoutChain(pages)).toEqual([
      { urlPath: "/blog/hello", params: { slug: "hello" } },
      { urlPath: "/blog/world", params: { slug: "world" } },
    ]);
  });

  it("throws when two different routes generate the same URL", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/blog/hello",
        page: true,
        module: component,
        filePath: "blog/hello/page.tsx",
      },
      {
        path: "/blog/:slug",
        page: true,
        module: pageModule(() => [{ slug: "hello" }]),
        filePath: "blog/[slug]/page.tsx",
      },
    ];
    await expect(collectStaticPaths(tree)).rejects.toThrow(
      /\("blog\/hello\/page\.tsx" and "blog\/\[slug\]\/page\.tsx"\) generate the same URL "\/blog\/hello"/,
    );
  });

  it("describes a conflicting page by its route path when it has no file", async () => {
    const tree: FsRouteTreeNode[] = [
      { path: "/about", page: true, module: component },
      { path: "/about", page: true, module: component },
    ];
    await expect(collectStaticPaths(tree)).rejects.toThrow(
      /\(route "\/about" and route "\/about"\) generate the same URL "\/about"/,
    );
  });

  it("allows a client component page on a static route", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/about",
        page: true,
        module: { default: clientReference("default") },
        filePath: "about/page.tsx",
      },
    ];
    const pages = await collectStaticPaths(tree);
    expect(withoutChain(pages)).toEqual([{ urlPath: "/about", params: {} }]);
  });

  it('explains that a "use client" page cannot export generateStaticParams', async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/blog/:slug",
        page: true,
        module: clientPageModule(),
        filePath: "blog/[slug]/page.tsx",
      },
    ];
    await expect(collectStaticPaths(tree)).rejects.toThrow(
      /\("blog\/\[slug\]\/page\.tsx"\).*marked "use client"/,
    );
  });

  it("names the source file in errors when the node carries one", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/blog/:slug",
        page: true,
        module: component,
        filePath: "blog/[slug]/page.tsx",
      },
    ];
    await expect(collectStaticPaths(tree)).rejects.toThrow(
      /\("blog\/\[slug\]\/page\.tsx"\) has no generateStaticParams/,
    );
  });

  it("names the source file when a param value is missing", async () => {
    const tree: FsRouteTreeNode[] = [
      {
        path: "/blog/:slug",
        page: true,
        module: pageModule(() => [{ other: "x" }]),
        filePath: "blog/[slug]/page.tsx",
      },
    ];
    await expect(collectStaticPaths(tree)).rejects.toThrow(
      /\("blog\/\[slug\]\/page\.tsx"\) is missing a value for param "slug"/,
    );
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

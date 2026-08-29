import { describe, expect, it } from "vitest";
import { nextRoutes } from "./nextAdapter";
import type { FsRouteFile, FsRouteModule, FsRouteTreeNode } from "./types";

interface MarkedModule extends FsRouteModule {
  __id: string;
}

function makeFiles(paths: string[]): FsRouteFile[] {
  return paths.map((filePath) => ({
    filePath,
    module: { default: () => null, __id: filePath } as MarkedModule,
  }));
}

interface SimpleNode {
  path: string | undefined;
  page: boolean;
  id: string;
  children?: SimpleNode[];
}

function simplify(nodes: FsRouteTreeNode[]): SimpleNode[] {
  return nodes.map((node) => {
    const simple: SimpleNode = {
      path: node.path,
      page: node.page,
      id: (node.module as MarkedModule).__id,
    };
    if (node.children) {
      simple.children = simplify(node.children);
    }
    return simple;
  });
}

describe("nextRoutes adapter", () => {
  it("maps flat pages without a layout to sibling routes", () => {
    const adapter = nextRoutes();
    const tree = adapter.buildRoutes(
      makeFiles(["page.tsx", "about/page.tsx", "blog/page.tsx"]),
    );
    expect(simplify(tree)).toEqual([
      { path: "/", page: true, id: "page.tsx" },
      { path: "/about", page: true, id: "about/page.tsx" },
      { path: "/blog", page: true, id: "blog/page.tsx" },
    ]);
  });

  it("wraps pages in a pathless root layout", () => {
    const adapter = nextRoutes();
    const tree = adapter.buildRoutes(
      makeFiles([
        "layout.tsx",
        "page.tsx",
        "about/page.tsx",
        "blog/page.tsx",
        "blog/[slug]/page.tsx",
      ]),
    );
    expect(simplify(tree)).toEqual([
      {
        path: undefined,
        page: false,
        id: "layout.tsx",
        children: [
          { path: "/", page: true, id: "page.tsx" },
          { path: "/about", page: true, id: "about/page.tsx" },
          { path: "/blog", page: true, id: "blog/page.tsx" },
          { path: "/blog/:slug", page: true, id: "blog/[slug]/page.tsx" },
        ],
      },
    ]);
  });

  it("nests a directory layout and treats its page as an index route", () => {
    const adapter = nextRoutes();
    const tree = adapter.buildRoutes(
      makeFiles([
        "dashboard/layout.tsx",
        "dashboard/page.tsx",
        "dashboard/settings/page.tsx",
      ]),
    );
    expect(simplify(tree)).toEqual([
      {
        path: "/dashboard",
        page: false,
        id: "dashboard/layout.tsx",
        children: [
          { path: "/", page: true, id: "dashboard/page.tsx" },
          { path: "/settings", page: true, id: "dashboard/settings/page.tsx" },
        ],
      },
    ]);
  });

  it("ignores route groups, supports catch-all, and ignores non-route files", () => {
    const adapter = nextRoutes();
    const tree = adapter.buildRoutes(
      makeFiles([
        "(marketing)/contact/page.tsx",
        "docs/[...slug]/page.tsx",
        "shared/Button.tsx",
      ]),
    );
    expect(simplify(tree)).toEqual([
      { path: "/contact", page: true, id: "(marketing)/contact/page.tsx" },
      { path: "/docs/:slug*", page: true, id: "docs/[...slug]/page.tsx" },
    ]);
  });

  it("orders static routes before dynamic siblings", () => {
    const adapter = nextRoutes();
    const tree = adapter.buildRoutes(
      makeFiles(["blog/[slug]/page.tsx", "blog/about/page.tsx"]),
    );
    expect(simplify(tree)).toEqual([
      { path: "/blog/about", page: true, id: "blog/about/page.tsx" },
      { path: "/blog/:slug", page: true, id: "blog/[slug]/page.tsx" },
    ]);
  });

  it("orders static and dynamic routes before catch-all siblings", () => {
    const adapter = nextRoutes();
    const tree = adapter.buildRoutes(
      makeFiles([
        "docs/[...slug]/page.tsx",
        "docs/[version]/page.tsx",
        "docs/intro/page.tsx",
      ]),
    );
    expect(simplify(tree)).toEqual([
      { path: "/docs/intro", page: true, id: "docs/intro/page.tsx" },
      { path: "/docs/:version", page: true, id: "docs/[version]/page.tsx" },
      { path: "/docs/:slug*", page: true, id: "docs/[...slug]/page.tsx" },
    ]);
  });

  it("orders routes by specificity inside a layout", () => {
    const adapter = nextRoutes();
    const tree = adapter.buildRoutes(
      makeFiles([
        "blog/layout.tsx",
        "blog/[slug]/page.tsx",
        "blog/archive/page.tsx",
        "blog/page.tsx",
      ]),
    );
    expect(simplify(tree)).toEqual([
      {
        path: "/blog",
        page: false,
        id: "blog/layout.tsx",
        children: [
          { path: "/", page: true, id: "blog/page.tsx" },
          { path: "/archive", page: true, id: "blog/archive/page.tsx" },
          { path: "/:slug", page: true, id: "blog/[slug]/page.tsx" },
        ],
      },
    ]);
  });

  it("orders a grouped layout with dynamic children after static siblings", () => {
    const adapter = nextRoutes();
    const tree = adapter.buildRoutes(
      makeFiles([
        "(app)/layout.tsx",
        "(app)/[slug]/page.tsx",
        "about/page.tsx",
      ]),
    );
    expect(simplify(tree)).toEqual([
      { path: "/about", page: true, id: "about/page.tsx" },
      {
        path: undefined,
        page: false,
        id: "(app)/layout.tsx",
        children: [{ path: "/:slug", page: true, id: "(app)/[slug]/page.tsx" }],
      },
    ]);
  });

  it("rejects optional catch-all segments", () => {
    const adapter = nextRoutes();
    expect(() =>
      adapter.buildRoutes(makeFiles(["docs/[[...slug]]/page.tsx"])),
    ).toThrow(/Optional catch-all segments/);
  });

  it("rejects parallel route slots", () => {
    const adapter = nextRoutes();
    expect(() => adapter.buildRoutes(makeFiles(["@modal/page.tsx"]))).toThrow(
      /Parallel route slots/,
    );
  });

  it("rejects intercepting routes", () => {
    const adapter = nextRoutes();
    expect(() =>
      adapter.buildRoutes(makeFiles(["feed/(..)photo/page.tsx"])),
    ).toThrow(/Intercepting routes/);
  });

  it("rejects param names URL patterns cannot express", () => {
    const adapter = nextRoutes();
    expect(() =>
      adapter.buildRoutes(makeFiles(["blog/[foo-bar]/page.tsx"])),
    ).toThrow(/Invalid param name "foo-bar"/);
    expect(() =>
      adapter.buildRoutes(makeFiles(["docs/[...foo.bar]/page.tsx"])),
    ).toThrow(/Invalid param name "foo\.bar"/);
  });

  it("allows param names with letters, digits, underscore, and dollar", () => {
    const adapter = nextRoutes();
    const tree = adapter.buildRoutes(makeFiles(["u/[$user_1]/page.tsx"]));
    expect(simplify(tree)).toEqual([
      { path: "/u/:$user_1", page: true, id: "u/[$user_1]/page.tsx" },
    ]);
  });

  it("rejects a param name used twice on one route path", () => {
    const adapter = nextRoutes();
    expect(() =>
      adapter.buildRoutes(makeFiles(["[slug]/x/[slug]/page.tsx"])),
    ).toThrow(/Duplicate param name "slug"/);
    // Also across a layout boundary, where the inner value would shadow
    // the outer one.
    expect(() =>
      adapter.buildRoutes(
        makeFiles(["[id]/layout.tsx", "[id]/sub/[id]/page.tsx"]),
      ),
    ).toThrow(/Duplicate param name "id"/);
  });

  it("rejects static directory names containing URL pattern characters", () => {
    const adapter = nextRoutes();
    for (const dir of ["a+b", "a?b", "a*b", "a:b", "a(b)c", "a{b}"]) {
      expect(() => adapter.buildRoutes(makeFiles([`${dir}/page.tsx`]))).toThrow(
        /special meaning in URL patterns/,
      );
    }
  });

  it("rejects two pages resolving to the same route via route groups", () => {
    const adapter = nextRoutes();
    expect(() =>
      adapter.buildRoutes(makeFiles(["(a)/foo/page.tsx", "(b)/foo/page.tsx"])),
    ).toThrow(/resolve to the same route/);
  });

  it("rejects sibling dynamic pages with different param names", () => {
    const adapter = nextRoutes();
    expect(() =>
      adapter.buildRoutes(
        makeFiles(["blog/[a]/page.tsx", "blog/[b]/page.tsx"]),
      ),
    ).toThrow(/resolve to the same route/);
  });

  it("rejects duplicate page files in one directory", () => {
    const adapter = nextRoutes();
    expect(() =>
      adapter.buildRoutes(makeFiles(["about/page.tsx", "about/page.jsx"])),
    ).toThrow(/Duplicate page files/);
  });

  it("allows multiple root layouts via route groups", () => {
    const adapter = nextRoutes();
    const tree = adapter.buildRoutes(
      makeFiles([
        "(marketing)/layout.tsx",
        "(marketing)/page.tsx",
        "(shop)/layout.tsx",
        "(shop)/cart/page.tsx",
      ]),
    );
    expect(simplify(tree)).toEqual([
      {
        path: undefined,
        page: false,
        id: "(marketing)/layout.tsx",
        children: [{ path: "/", page: true, id: "(marketing)/page.tsx" }],
      },
      {
        path: undefined,
        page: false,
        id: "(shop)/layout.tsx",
        children: [{ path: "/cart", page: true, id: "(shop)/cart/page.tsx" }],
      },
    ]);
  });

  it("allows a dynamic page next to a catch-all sibling", () => {
    const adapter = nextRoutes();
    const tree = adapter.buildRoutes(
      makeFiles(["docs/[page]/page.tsx", "docs/[...rest]/page.tsx"]),
    );
    expect(simplify(tree)).toEqual([
      { path: "/docs/:page", page: true, id: "docs/[page]/page.tsx" },
      { path: "/docs/:rest*", page: true, id: "docs/[...rest]/page.tsx" },
    ]);
  });

  it("records the source file path on each node", () => {
    const tree = nextRoutes().buildRoutes(
      makeFiles(["layout.tsx", "page.tsx", "blog/[slug]/page.tsx"]),
    );
    expect(tree[0]!.filePath).toBe("layout.tsx");
    expect(tree[0]!.children!.map((child) => child.filePath)).toEqual([
      "page.tsx",
      "blog/[slug]/page.tsx",
    ]);
  });

  it("honours custom page/layout file names", () => {
    const adapter = nextRoutes({
      pageFileName: "index",
      layoutFileName: "_layout",
    });
    const tree = adapter.buildRoutes(
      makeFiles(["_layout.tsx", "index.tsx", "about/index.tsx"]),
    );
    expect(simplify(tree)).toEqual([
      {
        path: undefined,
        page: false,
        id: "_layout.tsx",
        children: [
          { path: "/", page: true, id: "index.tsx" },
          { path: "/about", page: true, id: "about/index.tsx" },
        ],
      },
    ]);
  });
});

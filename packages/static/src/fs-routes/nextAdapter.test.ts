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

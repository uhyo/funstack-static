import { isValidElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createFsRoutesEntriesWithHost,
  type FsRoutesRuntimeHost,
} from "./runtime";
import type { EntryDefinition } from "../entryDefinition";
import type { FsRouteComponentProps, FsRouteModule } from "./types";
import type { FsRouteSlotProps } from "./slot";

function clientReference(): () => never {
  return Object.defineProperties(
    (): never => {
      throw new Error("Unexpectedly client reference is called on server");
    },
    { $$typeof: { value: Symbol.for("react.client.reference") } },
  );
}

const Root = ({ children }: { children: React.ReactNode }) => children;

const FakeSlot = (_props: FsRouteSlotProps): React.ReactNode => null;

interface RegisteredChunk {
  element: ReactElement<FsRouteComponentProps>;
  name: string;
  id: string;
}

function fakeHost(): {
  host: FsRoutesRuntimeHost;
  registered: RegisteredChunk[];
  restored: RegisteredChunk[];
  /** The chunks currently live in the (fake) defer registry, by ID. */
  live: Map<string, ReactElement<FsRouteComponentProps>>;
} {
  const registered: RegisteredChunk[] = [];
  const restored: RegisteredChunk[] = [];
  const live = new Map<string, ReactElement<FsRouteComponentProps>>();
  const host: FsRoutesRuntimeHost = {
    registerChunk(element, name) {
      const id = `fun__rsc-payload/chunk-${registered.length}`;
      registered.push({
        element: element as ReactElement<FsRouteComponentProps>,
        name,
        id,
      });
      live.set(id, element as ReactElement<FsRouteComponentProps>);
      return id;
    },
    hasChunk: (id) => live.has(id),
    restoreChunk(element, id, name) {
      restored.push({
        element: element as ReactElement<FsRouteComponentProps>,
        name,
        id,
      });
      live.set(id, element as ReactElement<FsRouteComponentProps>);
    },
    RouteSlot: FakeSlot,
  };
  return { host, registered, restored, live };
}

interface DefinitionLike {
  id?: string;
  path?: string;
  component?: unknown;
  children?: DefinitionLike[];
}

/**
 * Renders an entry's `FsRoutesApp` element (a plain function component) to
 * obtain the Router element and returns its route definitions.
 */
function routesOfEntry(entry: EntryDefinition): DefinitionLike[] {
  const app = entry.app as React.ReactElement<object> & {
    type: (props: object) => React.ReactElement<{ routes: DefinitionLike[] }>;
  };
  return app.type(app.props).props.routes;
}

function collectDefinitions(
  definitions: DefinitionLike[],
  into: DefinitionLike[] = [],
): DefinitionLike[] {
  for (const definition of definitions) {
    into.push(definition);
    if (definition.children) {
      collectDefinitions(definition.children, into);
    }
  }
  return into;
}

async function entriesFor(
  modules: Record<string, FsRouteModule>,
  host: FsRoutesRuntimeHost = fakeHost().host,
): Promise<EntryDefinition[]> {
  const getEntries = createFsRoutesEntriesWithHost(
    {
      modules,
      base: "./pages",
      root: Root,
    },
    host,
  );
  const entries: EntryDefinition[] = [];
  for await (const entry of getEntries()) {
    entries.push(entry);
  }
  return entries;
}

function slotOf(definition: DefinitionLike): FsRouteSlotProps {
  expect(isValidElement(definition.component)).toBe(true);
  const element = definition.component as ReactElement<FsRouteSlotProps>;
  expect(element.type).toBe(FakeSlot);
  return element.props;
}

describe("createFsRoutesEntries route definitions", () => {
  const clientLayout = clientReference();
  const modules: Record<string, FsRouteModule> = {
    "./pages/[lang]/layout.tsx": { default: clientLayout },
    "./pages/[lang]/page.tsx": {
      default: () => null,
      generateStaticParams: () => [{ lang: "en" }, { lang: "ja" }],
    },
    "./pages/about/page.tsx": { default: () => null },
  };

  it("passes a Client Component as a component type so the router renders it with live params", async () => {
    const entries = await entriesFor(modules);
    const routes = routesOfEntry(entries.find((e) => e.path === "en.html")!);
    const layout = routes.find((d) => d.path === "/:lang")!;
    expect(layout.component).toBe(clientLayout);
  });

  it("wraps a Server Component in a slot with build-time output and its route object", async () => {
    const entries = await entriesFor(modules);
    const routes = routesOfEntry(entries.find((e) => e.path === "ja.html")!);
    const layout = routes.find((d) => d.path === "/:lang")!;
    const page = layout.children!.find((d) => d.path === "/")!;
    const slot = slotOf(page);
    expect(slot.route).toEqual({ id: page.id });
    expect(slot.paramNames).toEqual(["lang"]);
    expect(slot.initialKey).toBe('["ja"]');
    expect(isValidElement(slot.initial)).toBe(true);
    const initial = slot.initial as ReactElement<FsRouteComponentProps>;
    expect(initial.props.params).toEqual({ lang: "ja" });
    expect(initial.props.route).toEqual({ id: page.id });
  });

  it("registers one chunk per Server Component node per params combination", async () => {
    const { host, registered } = fakeHost();
    const entries = await entriesFor(modules, host);
    // [lang]/page for en and ja, about/page once; the client layout gets none.
    expect(registered).toHaveLength(3);
    const langChunks = registered.filter((r) =>
      r.name.startsWith("fs-route [lang]/page.tsx"),
    );
    expect(langChunks.map((r) => r.element.props.params)).toEqual([
      { lang: "en" },
      { lang: "ja" },
    ]);

    // Every page's payload carries the same chunk map for a given node.
    const slots = entries.map((entry) => {
      const routes = routesOfEntry(entry);
      const layout = routes.find((d) => d.path === "/:lang")!;
      return slotOf(layout.children!.find((d) => d.path === "/")!);
    });
    for (const slot of slots) {
      expect(slot.chunks).toEqual({
        '["en"]': langChunks[0]!.id,
        '["ja"]': langChunks[1]!.id,
      });
    }
  });

  it("inlines build-time output only for nodes on the page's own chain", async () => {
    const entries = await entriesFor(modules);
    const routes = routesOfEntry(entries.find((e) => e.path === "en.html")!);
    const about = routes.find((d) => d.path === "/about")!;
    const slot = slotOf(about);
    expect(slot.initialKey).toBeUndefined();
    expect(slot.initial).toBeUndefined();
    expect(Object.keys(slot.chunks)).toEqual(["[]"]);
  });

  it("restricts a Server Component layout's params to its own segments", async () => {
    const { host, registered } = fakeHost();
    const serverLayout = () => null;
    await entriesFor(
      {
        "./pages/[lang]/docs/layout.tsx": { default: serverLayout },
        "./pages/[lang]/docs/[slug]/page.tsx": {
          default: () => null,
          generateStaticParams: () => [
            { lang: "en", slug: "a" },
            { lang: "en", slug: "b" },
            { lang: "ja", slug: "a" },
          ],
        },
      },
      host,
    );
    const layoutChunks = registered.filter((r) =>
      r.name.startsWith("fs-route [lang]/docs/layout.tsx"),
    );
    // One chunk per lang, shared by all slugs, with only the lang param.
    expect(layoutChunks.map((r) => r.element.props.params)).toEqual([
      { lang: "en" },
      { lang: "ja" },
    ]);
    const pageChunks = registered.filter((r) =>
      r.name.startsWith("fs-route [lang]/docs/[slug]/page.tsx"),
    );
    expect(pageChunks).toHaveLength(3);
  });

  it("assigns a unique id to every route definition", async () => {
    const entries = await entriesFor(modules);
    for (const entry of entries) {
      const definitions = collectDefinitions(routesOfEntry(entry));
      const ids = definitions.map((d) => d.id);
      expect(ids.every((id) => typeof id === "string" && id !== "")).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("assigns the same ids on every page so route objects stay portable", async () => {
    const entries = await entriesFor(modules);
    const idsPerEntry = entries.map((entry) =>
      collectDefinitions(routesOfEntry(entry)).map((d) => `${d.path} ${d.id}`),
    );
    for (const ids of idsPerEntry) {
      expect(ids).toEqual(idsPerEntry[0]);
    }
  });

  it("throws for a page module without a default export", async () => {
    await expect(entriesFor({ "./pages/about/page.tsx": {} })).rejects.toThrow(
      /page module "about\/page\.tsx" has no default export/,
    );
  });

  it("throws for a layout module without a default export", async () => {
    await expect(
      entriesFor({
        "./pages/layout.tsx": { notDefault: () => null },
        "./pages/page.tsx": { default: () => null },
      }),
    ).rejects.toThrow(/layout module "layout\.tsx" has no default export/);
  });
});

describe("createFsRoutesEntries enumeration caching", () => {
  function factoryFor(
    modules: Record<string, FsRouteModule>,
    host: FsRoutesRuntimeHost,
  ) {
    return createFsRoutesEntriesWithHost(
      { modules, base: "./pages", root: Root },
      host,
    );
  }

  async function drain(
    getEntries: () =>
      AsyncIterable<EntryDefinition> | Iterable<EntryDefinition>,
  ): Promise<EntryDefinition[]> {
    const entries: EntryDefinition[] = [];
    for await (const entry of getEntries()) {
      entries.push(entry);
    }
    return entries;
  }

  it("enumerates the site once and reuses chunk IDs across iterations", async () => {
    const generateStaticParams = vi.fn(() => [{ lang: "en" }, { lang: "ja" }]);
    const { host, registered } = fakeHost();
    const getEntries = factoryFor(
      {
        "./pages/[lang]/page.tsx": {
          default: () => null,
          generateStaticParams,
        },
        "./pages/about/page.tsx": { default: () => null },
      },
      host,
    );

    const first = await drain(getEntries);
    const second = await drain(getEntries);

    // The dev server iterates getEntries() per request; generateStaticParams
    // and chunk registration must not run again.
    expect(generateStaticParams).toHaveBeenCalledTimes(1);
    expect(registered).toHaveLength(3);

    // The second iteration serves the same chunk IDs, so payloads held by
    // earlier requests stay consistent with the registry.
    const chunksOf = (entries: EntryDefinition[], path: string) => {
      const routes = routesOfEntry(entries.find((e) => e.path === path)!);
      const definitions = collectDefinitions(routes);
      const page = definitions.find((d) => d.path === "/:lang")!;
      return slotOf(page).chunks;
    };
    expect(chunksOf(second, "en.html")).toEqual(chunksOf(first, "en.html"));
  });

  it("re-registers evicted chunks under their original IDs", async () => {
    const { host, registered, restored, live } = fakeHost();
    const getEntries = factoryFor(
      {
        "./pages/[lang]/page.tsx": {
          default: () => null,
          generateStaticParams: () => [{ lang: "en" }, { lang: "ja" }],
        },
      },
      host,
    );
    await drain(getEntries);
    expect(registered).toHaveLength(2);

    // Simulate the dev defer registry evicting one chunk between requests.
    const evicted = registered[0]!;
    live.delete(evicted.id);

    await drain(getEntries);
    expect(restored).toHaveLength(1);
    expect(restored[0]!.id).toBe(evicted.id);
    expect(restored[0]!.name).toBe(evicted.name);
    expect(restored[0]!.element).toBe(evicted.element);
    expect(live.has(evicted.id)).toBe(true);
  });

  it("does not cache a failed enumeration", async () => {
    const generateStaticParams = vi
      .fn<() => { lang: string }[]>()
      .mockImplementationOnce(() => {
        throw new Error("CMS is down");
      })
      .mockImplementation(() => [{ lang: "en" }]);
    const { host } = fakeHost();
    const getEntries = factoryFor(
      {
        "./pages/[lang]/page.tsx": {
          default: () => null,
          generateStaticParams,
        },
      },
      host,
    );

    await expect(drain(getEntries)).rejects.toThrow("CMS is down");
    // The next request retries instead of replaying the cached failure.
    const entries = await drain(getEntries);
    expect(entries.map((e) => e.path)).toEqual(["en.html"]);
    expect(generateStaticParams).toHaveBeenCalledTimes(2);
  });
});

import { isValidElement } from "react";
import { describe, expect, it } from "vitest";
import { createFsRoutesEntries } from "./runtime";
import type { EntryDefinition } from "../entryDefinition";
import type { FsRouteComponentProps, FsRouteModule } from "./types";

function clientReference(): () => never {
  return Object.defineProperties(
    (): never => {
      throw new Error("Unexpectedly client reference is called on server");
    },
    { $$typeof: { value: Symbol.for("react.client.reference") } },
  );
}

const Root = ({ children }: { children: React.ReactNode }) => children;

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
): Promise<EntryDefinition[]> {
  const getEntries = createFsRoutesEntries({
    modules,
    base: "./pages",
    root: Root,
  });
  const entries: EntryDefinition[] = [];
  for await (const entry of getEntries()) {
    entries.push(entry);
  }
  return entries;
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

  it("renders a Server Component with build-time params and its route object", async () => {
    const entries = await entriesFor(modules);
    const routes = routesOfEntry(entries.find((e) => e.path === "ja.html")!);
    const layout = routes.find((d) => d.path === "/:lang")!;
    const page = layout.children!.find((d) => d.path === "/")!;
    expect(isValidElement(page.component)).toBe(true);
    const props = (page.component as React.ReactElement<FsRouteComponentProps>)
      .props;
    expect(props.params).toEqual({ lang: "ja" });
    expect(props.route).toEqual({ id: page.id });
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
});

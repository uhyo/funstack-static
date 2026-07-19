import { describe, it, expect, vi } from "vitest";
import { processRscComponents } from "./rscProcessor";

const dir = "fun__rsc-payload";

function id(rawId: string): string {
  return `${dir}/${rawId}`;
}

function streamOf(content: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(content));
      controller.close();
    },
  });
}

async function* componentsOf(
  items: Array<{ id: string; data: string; name?: string }>,
) {
  yield* items;
}

/**
 * Extracts all payload IDs referenced in a content string.
 */
function referencedIds(content: string): string[] {
  return [...content.matchAll(/fun__rsc-payload\/[\w-]+/g)].map((m) => m[0]);
}

describe("processRscComponents", () => {
  it("replaces temp IDs with content hashes in app content", async () => {
    const a = id("temp-a");
    const result = await processRscComponents(
      componentsOf([{ id: a, data: "content of a" }]),
      streamOf(`app references ${a}`),
      dir,
    );

    expect(result.components).toHaveLength(1);
    const finalId = result.components[0]!.finalId;
    expect(finalId).not.toBe(a);
    expect(result.appRscContent).toBe(`app references ${finalId}`);
  });

  it("finalizes nested references before hashing the referencing payload", async () => {
    const parent = id("temp-parent");
    const child = id("temp-child");
    const result = await processRscComponents(
      componentsOf([
        { id: parent, data: `parent references ${child}` },
        { id: child, data: "child content" },
      ]),
      streamOf(`app references ${parent}`),
      dir,
    );

    const finalIds = result.components.map((c) => c.finalId);
    for (const component of result.components) {
      // No emitted payload may reference a temp ID; every reference must
      // point to another emitted payload.
      expect(component.finalContent).not.toContain("temp-");
      for (const ref of referencedIds(component.finalContent)) {
        expect(finalIds).toContain(ref);
      }
    }
    expect(result.appRscContent).not.toContain("temp-");
    expect(finalIds).toContain(referencedIds(result.appRscContent)[0]);
  });

  it("resolves a diamond of references", async () => {
    const top = id("temp-top");
    const left = id("temp-left");
    const right = id("temp-right");
    const bottom = id("temp-bottom");
    const result = await processRscComponents(
      componentsOf([
        { id: top, data: `top references ${left} and ${right}` },
        { id: left, data: `left references ${bottom}` },
        { id: right, data: `right references ${bottom}` },
        { id: bottom, data: "bottom content" },
      ]),
      streamOf(`app references ${top}`),
      dir,
    );

    for (const component of result.components) {
      expect(component.finalContent).not.toContain("temp-");
    }
    expect(result.appRscContent).not.toContain("temp-");
  });

  it("produces the same hashes regardless of temp IDs and order", async () => {
    async function run(rawParent: string, rawChild: string, flip: boolean) {
      const parent = id(rawParent);
      const child = id(rawChild);
      const items = [
        { id: parent, data: `parent references ${child}` },
        { id: child, data: "child content" },
      ];
      if (flip) items.reverse();
      const result = await processRscComponents(
        componentsOf(items),
        streamOf(`app references ${parent}`),
        dir,
      );
      return {
        finalIds: new Set(result.components.map((c) => c.finalId)),
        appRscContent: result.appRscContent,
      };
    }

    const first = await run("temp-parent-1", "temp-child-1", false);
    const second = await run("temp-parent-2", "temp-child-2", true);
    expect(first.finalIds).toEqual(second.finalIds);
    expect(first.appRscContent).toBe(second.appRscContent);
  });

  it("keeps temp IDs for components in cycles and warns", async () => {
    const a = id("temp-a");
    const b = id("temp-b");
    const warn = vi.fn();
    const result = await processRscComponents(
      componentsOf([
        { id: a, data: `a references ${b}` },
        { id: b, data: `b references ${a}` },
      ]),
      streamOf(`app references ${a}`),
      dir,
      { warn },
    );

    expect(warn).toHaveBeenCalledTimes(1);
    const finalIds = result.components.map((c) => c.finalId).sort();
    expect(finalIds).toEqual([a, b]);
    expect(result.appRscContent).toBe(`app references ${a}`);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import type { ReactElement } from "react";
import { DeferRegistry, devDeferEntryTTL } from "./deferRegistry";

const encoder = new TextEncoder();

/**
 * Fake renderer that emits the element's `data-payload` prop as the stream
 * content, so tests can verify what was rendered without the RSC runtime.
 */
function fakeRender(element: ReactElement): ReadableStream<Uint8Array> {
  const payload = String(
    (element.props as { "data-payload"?: string })["data-payload"] ?? "",
  );
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

function element(payload: string): ReactElement {
  return createElement("div", { "data-payload": payload });
}

describe("DeferRegistry", () => {
  let registry: DeferRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new DeferRegistry(fakeRender);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for unknown ids", () => {
    expect(registry.load("nope")).toBeUndefined();
  });

  it("loads a registered entry and drains its payload", async () => {
    registry.register(element("hello"), "id1");
    const entry = registry.load("id1");
    expect(entry).toBeDefined();
    expect(entry?.state.state).toBe("streaming");
    await expect(entry?.drainPromise).resolves.toBe("hello");
    expect(entry?.state.state).toBe("ready");
  });

  describe("evictStale", () => {
    it("evicts entries older than the TTL and keeps fresh ones", () => {
      registry.register(element("old"), "old");
      vi.advanceTimersByTime(devDeferEntryTTL + 1);
      registry.register(element("fresh"), "fresh");

      registry.evictStale(devDeferEntryTTL);

      expect(registry.has("old")).toBe(false);
      expect(registry.has("fresh")).toBe(true);
    });

    it("keeps entries within the TTL", () => {
      registry.register(element("a"), "a");
      vi.advanceTimersByTime(devDeferEntryTTL);

      registry.evictStale(devDeferEntryTTL);

      expect(registry.has("a")).toBe(true);
    });

    it("treats a load as an access that refreshes the TTL", () => {
      registry.register(element("a"), "a");
      vi.advanceTimersByTime(devDeferEntryTTL - 1);
      registry.load("a");
      vi.advanceTimersByTime(devDeferEntryTTL - 1);

      registry.evictStale(devDeferEntryTTL);
      expect(registry.has("a")).toBe(true);

      vi.advanceTimersByTime(2);
      registry.evictStale(devDeferEntryTTL);
      expect(registry.has("a")).toBe(false);
    });

    it("evicts loaded (ready) entries once stale", async () => {
      registry.register(element("a"), "a");
      const entry = registry.load("a");
      await entry?.drainPromise;

      vi.advanceTimersByTime(devDeferEntryTTL + 1);
      registry.evictStale(devDeferEntryTTL);

      expect(registry.has("a")).toBe(false);
    });

    it("does not break an already-loaded entry when it is evicted", async () => {
      registry.register(element("in-flight"), "a");
      const entry = registry.load("a");

      vi.advanceTimersByTime(devDeferEntryTTL + 1);
      registry.evictStale(devDeferEntryTTL);
      expect(registry.has("a")).toBe(false);

      // The response holding the entry can still drain it.
      await expect(entry?.drainPromise).resolves.toBe("in-flight");
    });
  });

  describe("loadAll", () => {
    it("yields all registered entries", async () => {
      registry.register(element("one"), "id1", "first");
      registry.register(element("two"), "id2");

      const results = [];
      for await (const result of registry.loadAll()) {
        results.push(result);
      }

      results.sort((a, b) => a.id.localeCompare(b.id));
      expect(results).toEqual([
        { id: "id1", data: "one", name: "first" },
        { id: "id2", data: "two", name: undefined },
      ]);
    });

    it("picks up entries registered while draining (nested defer)", async () => {
      const nested = element("nested");
      const parent: ReactElement = createElement("div", {
        "data-payload": "parent",
      });
      const renderWithNested = (el: ReactElement) => {
        if (el === parent) {
          return new ReadableStream<Uint8Array>({
            start(controller) {
              // Simulates a nested defer() call during the parent's render.
              registry.register(nested, "nested-id");
              controller.enqueue(encoder.encode("parent"));
              controller.close();
            },
          });
        }
        return fakeRender(el);
      };
      registry = new DeferRegistry(renderWithNested);
      registry.register(parent, "parent-id");

      const ids = [];
      for await (const result of registry.loadAll()) {
        ids.push(result.id);
      }

      expect(ids.sort()).toEqual(["nested-id", "parent-id"]);
    });
  });
});

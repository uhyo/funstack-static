import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import type { ReactElement } from "react";
import { DeferRegistry, devDeferEvictionOptions } from "./deferRegistry";

const { ttlMs } = devDeferEvictionOptions;

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
    it("never evicts pending entries by time", () => {
      // A pending entry may be fetched arbitrarily late, e.g. deferred
      // content inside an accordion that is rarely opened.
      registry.register(element("accordion"), "a");
      vi.advanceTimersByTime(ttlMs * 100);

      registry.evictStale(devDeferEvictionOptions);

      expect(registry.has("a")).toBe(true);
    });

    it("evicts settled entries older than the TTL and keeps fresh ones", async () => {
      registry.register(element("old"), "old");
      await registry.load("old")?.drainPromise;
      vi.advanceTimersByTime(ttlMs + 1);
      registry.register(element("fresh"), "fresh");
      await registry.load("fresh")?.drainPromise;

      registry.evictStale(devDeferEvictionOptions);

      expect(registry.has("old")).toBe(false);
      expect(registry.has("fresh")).toBe(true);
    });

    it("keeps settled entries within the TTL", async () => {
      registry.register(element("a"), "a");
      await registry.load("a")?.drainPromise;
      vi.advanceTimersByTime(ttlMs);

      registry.evictStale(devDeferEvictionOptions);

      expect(registry.has("a")).toBe(true);
    });

    it("treats a load as an access that refreshes the TTL", async () => {
      registry.register(element("a"), "a");
      await registry.load("a")?.drainPromise;
      vi.advanceTimersByTime(ttlMs - 1);
      registry.load("a");
      vi.advanceTimersByTime(ttlMs - 1);

      registry.evictStale(devDeferEvictionOptions);
      expect(registry.has("a")).toBe(true);

      vi.advanceTimersByTime(2);
      registry.evictStale(devDeferEvictionOptions);
      expect(registry.has("a")).toBe(false);
    });

    it("does not break an already-loaded entry when it is evicted", async () => {
      registry.register(element("in-flight"), "a");
      const entry = registry.load("a");

      vi.advanceTimersByTime(ttlMs + 1);
      registry.evictStale(devDeferEvictionOptions);
      expect(registry.has("a")).toBe(false);

      // The response holding the entry can still drain it.
      await expect(entry?.drainPromise).resolves.toBe("in-flight");
    });

    it("caps pending entries, evicting the oldest first", () => {
      registry.register(element("p1"), "p1");
      registry.register(element("p2"), "p2");
      registry.register(element("p3"), "p3");

      registry.evictStale({ ttlMs, maxPending: 2 });

      expect(registry.has("p1")).toBe(false);
      expect(registry.has("p2")).toBe(true);
      expect(registry.has("p3")).toBe(true);
    });

    it("does not count settled entries toward the pending cap", async () => {
      registry.register(element("s1"), "s1");
      await registry.load("s1")?.drainPromise;
      registry.register(element("p1"), "p1");
      registry.register(element("p2"), "p2");

      registry.evictStale({ ttlMs, maxPending: 2 });

      expect(registry.has("s1")).toBe(true);
      expect(registry.has("p1")).toBe(true);
      expect(registry.has("p2")).toBe(true);
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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { DeferRegistry, renderEvictionGracePeriodMs } from "./deferRegistry";

// The registry only passes elements through to renderToReadableStream, so
// mock rendering: emit `data` as the payload and invoke `onRender` (used by
// tests to simulate nested defer() calls made during rendering).
vi.mock("@vitejs/plugin-rsc/react/rsc", () => ({
  renderToReadableStream: (element: unknown) => {
    const el = element as { data: string; onRender?: () => void };
    el.onRender?.();
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(el.data));
        controller.close();
      },
    });
  },
}));

function el(data: string, onRender?: () => void): ReactElement {
  return { data, onRender } as unknown as ReactElement;
}

describe("DeferRegistry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads a registered entry and drains its payload", async () => {
    const registry = new DeferRegistry();
    registry.register(el("payload-a"), "id-a");

    const entry = registry.load("id-a");
    expect(entry).toBeDefined();
    expect(entry?.state.state).toBe("streaming");
    await expect(entry?.drainPromise).resolves.toBe("payload-a");
    expect(entry?.state.state).toBe("ready");
  });

  it("returns the render function's result from startRender", () => {
    const registry = new DeferRegistry();
    const result = registry.startRender("index.html", () => "rendered");
    expect(result).toBe("rendered");
  });

  it("evicts the previous render's entries after the grace period when a new render for the same key starts", async () => {
    const registry = new DeferRegistry();
    registry.startRender("index.html", () => {
      registry.register(el("a"), "id-a");
    });
    registry.startRender("index.html", () => {
      registry.register(el("b"), "id-b");
    });

    // Within the grace period, the previous render's entries survive.
    expect(registry.has("id-a")).toBe(true);
    expect(registry.has("id-b")).toBe(true);

    await vi.advanceTimersByTimeAsync(renderEvictionGracePeriodMs);
    expect(registry.has("id-a")).toBe(false);
    expect(registry.has("id-b")).toBe(true);
  });

  it("keeps the previous render's entries loadable during the grace period", async () => {
    const registry = new DeferRegistry();
    registry.startRender("index.html", () => {
      registry.register(el("stale"), "id-stale");
    });
    registry.startRender("index.html", () => {});

    const entry = registry.load("id-stale");
    await expect(entry?.drainPromise).resolves.toBe("stale");
  });

  it("does not evict entries belonging to a different key", async () => {
    const registry = new DeferRegistry();
    registry.startRender("a.html", () => {
      registry.register(el("a"), "id-a");
    });
    registry.startRender("b.html", () => {
      registry.register(el("b"), "id-b");
    });

    await vi.advanceTimersByTimeAsync(renderEvictionGracePeriodMs);
    expect(registry.has("id-a")).toBe(true);
    expect(registry.has("id-b")).toBe(true);
  });

  it("never evicts entries registered outside of a scoped render (build)", async () => {
    const registry = new DeferRegistry();
    registry.register(el("build-time"), "id-build");

    registry.startRender("index.html", () => {});
    registry.startRender("index.html", () => {});

    await vi.advanceTimersByTimeAsync(renderEvictionGracePeriodMs * 2);
    expect(registry.has("id-build")).toBe(true);
  });

  it("attributes nested defer registrations to the parent's render and evicts the whole tree", async () => {
    const registry = new DeferRegistry();
    registry.startRender("index.html", () => {
      registry.register(
        el("parent", () => {
          // Nested defer() during the parent's render; registered through
          // an async continuation to exercise AsyncLocalStorage propagation.
          queueMicrotask(() => {
            registry.register(el("child"), "id-child");
          });
        }),
        "id-parent",
      );
    });

    // Loading the parent (e.g. during SSR or a client fetch) triggers its
    // render, which registers the nested child under the same render.
    const parent = registry.load("id-parent");
    await parent?.drainPromise;
    expect(registry.has("id-child")).toBe(true);

    registry.startRender("index.html", () => {});
    await vi.advanceTimersByTimeAsync(renderEvictionGracePeriodMs);
    expect(registry.has("id-parent")).toBe(false);
    expect(registry.has("id-child")).toBe(false);
  });

  it("evicts nested registrations made after the render was superseded", async () => {
    const registry = new DeferRegistry();
    registry.startRender("index.html", () => {
      registry.register(
        el("parent", () => {
          registry.register(el("child"), "id-child");
        }),
        "id-parent",
      );
    });

    // The render is superseded before the parent is ever loaded.
    registry.startRender("index.html", () => {});

    // A client fetch during the grace period loads the parent, registering
    // the nested child into the already-invalidated render.
    const parent = registry.load("id-parent");
    await expect(parent?.drainPromise).resolves.toBe("parent");
    expect(registry.has("id-child")).toBe(true);

    await vi.advanceTimersByTimeAsync(renderEvictionGracePeriodMs);
    expect(registry.has("id-parent")).toBe(false);
    expect(registry.has("id-child")).toBe(false);
  });

  it("loadAll picks up nested entries registered mid-iteration", async () => {
    const registry = new DeferRegistry();
    registry.register(
      el("parent", () => {
        registry.register(el("child"), "id-child");
      }),
      "id-parent",
    );

    const results = new Map<string, string>();
    for await (const { id, data } of registry.loadAll()) {
      results.set(id, data);
    }
    expect(results).toEqual(
      new Map([
        ["id-parent", "parent"],
        ["id-child", "child"],
      ]),
    );
  });
});

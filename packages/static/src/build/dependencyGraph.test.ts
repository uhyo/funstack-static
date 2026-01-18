import { describe, it, expect } from "vitest";
import {
  findReferencedIds,
  topologicalSort,
} from "./dependencyGraph";

describe("findReferencedIds", () => {
  it("finds IDs that appear in content", () => {
    const content = 'Some content with id-1 and id-2 referenced';
    const allKnownIds = new Set(["id-1", "id-2", "id-3"]);

    const result = findReferencedIds(content, allKnownIds);

    expect(result).toEqual(new Set(["id-1", "id-2"]));
  });

  it("returns empty set when no IDs are referenced", () => {
    const content = "Some content without any references";
    const allKnownIds = new Set(["id-1", "id-2"]);

    const result = findReferencedIds(content, allKnownIds);

    expect(result).toEqual(new Set());
  });

  it("returns empty set when allKnownIds is empty", () => {
    const content = "Some content with id-1";
    const allKnownIds = new Set<string>();

    const result = findReferencedIds(content, allKnownIds);

    expect(result).toEqual(new Set());
  });

  it("finds IDs with special characters", () => {
    const content = 'Reference to fun:rsc-payload/abc-123 here';
    const allKnownIds = new Set([
      "fun:rsc-payload/abc-123",
      "fun:rsc-payload/def-456",
    ]);

    const result = findReferencedIds(content, allKnownIds);

    expect(result).toEqual(new Set(["fun:rsc-payload/abc-123"]));
  });
});

describe("topologicalSort", () => {
  it("sorts components with no dependencies", () => {
    const dependencies = new Map<string, Set<string>>([
      ["a", new Set()],
      ["b", new Set()],
      ["c", new Set()],
    ]);

    const result = topologicalSort(dependencies);

    expect(result.sorted).toHaveLength(3);
    expect(result.sorted).toContain("a");
    expect(result.sorted).toContain("b");
    expect(result.sorted).toContain("c");
    expect(result.inCycle).toEqual([]);
  });

  it("sorts linear dependency chain correctly", () => {
    // a -> b -> c (a depends on b, b depends on c)
    const dependencies = new Map<string, Set<string>>([
      ["a", new Set(["b"])],
      ["b", new Set(["c"])],
      ["c", new Set()],
    ]);

    const result = topologicalSort(dependencies);

    expect(result.inCycle).toEqual([]);
    expect(result.sorted).toHaveLength(3);

    // a should come before b, b should come before c
    const indexA = result.sorted.indexOf("a");
    const indexB = result.sorted.indexOf("b");
    const indexC = result.sorted.indexOf("c");
    expect(indexA).toBeLessThan(indexB);
    expect(indexB).toBeLessThan(indexC);
  });

  it("handles diamond dependency pattern", () => {
    //     a
    //    / \
    //   b   c
    //    \ /
    //     d
    const dependencies = new Map<string, Set<string>>([
      ["a", new Set(["b", "c"])],
      ["b", new Set(["d"])],
      ["c", new Set(["d"])],
      ["d", new Set()],
    ]);

    const result = topologicalSort(dependencies);

    expect(result.inCycle).toEqual([]);
    expect(result.sorted).toHaveLength(4);

    const indexA = result.sorted.indexOf("a");
    const indexB = result.sorted.indexOf("b");
    const indexC = result.sorted.indexOf("c");
    const indexD = result.sorted.indexOf("d");

    // a should come before b and c
    expect(indexA).toBeLessThan(indexB);
    expect(indexA).toBeLessThan(indexC);
    // b and c should come before d
    expect(indexB).toBeLessThan(indexD);
    expect(indexC).toBeLessThan(indexD);
  });

  it("detects simple cycle", () => {
    // a -> b -> a (cycle)
    const dependencies = new Map<string, Set<string>>([
      ["a", new Set(["b"])],
      ["b", new Set(["a"])],
    ]);

    const result = topologicalSort(dependencies);

    expect(result.sorted).toEqual([]);
    expect(result.inCycle).toHaveLength(2);
    expect(result.inCycle).toContain("a");
    expect(result.inCycle).toContain("b");
  });

  it("detects cycle while sorting non-cycle nodes", () => {
    // a -> b -> c -> b (b and c form a cycle, a depends on cycle)
    // d has no dependencies
    const dependencies = new Map<string, Set<string>>([
      ["a", new Set(["b"])],
      ["b", new Set(["c"])],
      ["c", new Set(["b"])],
      ["d", new Set()],
    ]);

    const result = topologicalSort(dependencies);

    // d should be sorted (no dependencies)
    // a should be sorted (depends on cycle but not in cycle itself)
    expect(result.sorted).toContain("d");
    expect(result.sorted).toContain("a");

    // b and c are in a cycle
    expect(result.inCycle).toHaveLength(2);
    expect(result.inCycle).toContain("b");
    expect(result.inCycle).toContain("c");
  });

  it("handles self-referencing node as cycle", () => {
    const dependencies = new Map<string, Set<string>>([
      ["a", new Set(["a"])], // self-reference
      ["b", new Set()],
    ]);

    const result = topologicalSort(dependencies);

    expect(result.sorted).toContain("b");
    expect(result.inCycle).toContain("a");
  });

  it("handles empty dependency map", () => {
    const dependencies = new Map<string, Set<string>>();

    const result = topologicalSort(dependencies);

    expect(result.sorted).toEqual([]);
    expect(result.inCycle).toEqual([]);
  });

  it("ignores references to unknown nodes", () => {
    // a references "unknown" which is not in the dependency map
    const dependencies = new Map<string, Set<string>>([
      ["a", new Set(["unknown"])],
      ["b", new Set()],
    ]);

    const result = topologicalSort(dependencies);

    expect(result.sorted).toHaveLength(2);
    expect(result.inCycle).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { replaceIdsInContent } from "./idReplacement";

describe("replaceIdsInContent", () => {
  it("replaces a single mapped ID", () => {
    const idMapping = new Map([["temp-1", "final-1"]]);

    const result = replaceIdsInContent("ref to temp-1 here", idMapping);

    expect(result).toBe("ref to final-1 here");
  });

  it("replaces multiple different IDs in one content", () => {
    const idMapping = new Map([
      ["temp-1", "final-1"],
      ["temp-2", "final-2"],
    ]);

    const result = replaceIdsInContent("temp-1 and temp-2", idMapping);

    expect(result).toBe("final-1 and final-2");
  });

  it("replaces all occurrences of the same ID", () => {
    const idMapping = new Map([["temp-1", "final-1"]]);

    const result = replaceIdsInContent("temp-1, temp-1, temp-1", idMapping);

    expect(result).toBe("final-1, final-1, final-1");
  });

  it("skips identity mappings", () => {
    const idMapping = new Map([
      ["temp-1", "temp-1"],
      ["temp-2", "final-2"],
    ]);

    const result = replaceIdsInContent("temp-1 and temp-2", idMapping);

    expect(result).toBe("temp-1 and final-2");
  });

  it("returns content unchanged when mapping is empty", () => {
    const content = "no changes expected";

    expect(replaceIdsInContent(content, new Map())).toBe(content);
  });

  it("returns content unchanged when mapping only has identity entries", () => {
    const idMapping = new Map([["temp-1", "temp-1"]]);
    const content = "temp-1 stays as is";

    expect(replaceIdsInContent(content, idMapping)).toBe(content);
  });

  it("escapes regex special characters in IDs", () => {
    const idMapping = new Map([["fun__rsc-payload/a.b+c(1)", "final-1"]]);

    const result = replaceIdsInContent(
      "see fun__rsc-payload/a.b+c(1) and fun__rsc-payload/aXb+c(1)",
      idMapping,
    );

    expect(result).toBe("see final-1 and fun__rsc-payload/aXb+c(1)");
  });

  it("does not re-replace IDs produced by earlier replacements", () => {
    const idMapping = new Map([
      ["temp-1", "temp-2"],
      ["temp-2", "final-2"],
    ]);

    const result = replaceIdsInContent("temp-1 temp-2", idMapping);

    expect(result).toBe("temp-2 final-2");
  });
});

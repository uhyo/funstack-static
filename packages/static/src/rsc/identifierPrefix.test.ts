import { describe, expect, it } from "vitest";
import {
  DeferIdentifierPrefixes,
  shellIdentifierPrefix,
} from "./identifierPrefix";

describe("DeferIdentifierPrefixes", () => {
  it("numbers unnamed payloads in registration order", () => {
    const prefixes = new DeferIdentifierPrefixes();

    expect(prefixes.next(undefined)).toBe("d0");
    expect(prefixes.next(undefined)).toBe("d1");
  });

  it("numbers named payloads per name", () => {
    const prefixes = new DeferIdentifierPrefixes();

    expect(prefixes.next("Sidebar")).toBe("Sidebar_0");
    expect(prefixes.next("Comments")).toBe("Comments_0");
    expect(prefixes.next("Sidebar")).toBe("Sidebar_1");
    expect(prefixes.next(undefined)).toBe("d0");
  });

  it("sanitizes names and counts names that sanitize alike together", () => {
    const prefixes = new DeferIdentifierPrefixes();

    expect(prefixes.next("fs-route src/pages/about.tsx {}")).toBe(
      "fs-route_src_pages_about_tsx_0",
    );
    // "Card!" and "Card?" both sanitize to "Card" and must not collide.
    expect(prefixes.next("Card!")).toBe("Card_0");
    expect(prefixes.next("Card?")).toBe("Card_1");
  });

  it("treats a name that sanitizes to nothing as no name", () => {
    const prefixes = new DeferIdentifierPrefixes();

    expect(prefixes.next("!!!")).toBe("d0");
    expect(prefixes.next(undefined)).toBe("d1");
  });

  it("never hands out the same prefix twice, even for ambiguous names", () => {
    const prefixes = new DeferIdentifierPrefixes();
    const seen = new Set<string>();
    const names = [undefined, "d", "d0", "a", "a_1", "a_1_2", "d_0", "shell"];
    for (let round = 0; round < 15; round++) {
      for (const name of names) {
        const prefix = prefixes.next(name);
        expect(seen.has(prefix)).toBe(false);
        seen.add(prefix);
      }
    }
    expect(seen.has(shellIdentifierPrefix)).toBe(false);
    expect(seen.has("")).toBe(false);
  });

  it("only uses characters that are safe in CSS selectors", () => {
    const prefixes = new DeferIdentifierPrefixes();

    for (const name of [undefined, "Hello World", "a/b.c:d", "日本語"]) {
      expect(prefixes.next(name)).toMatch(/^[A-Za-z0-9_-]+$/);
    }
    expect(shellIdentifierPrefix).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

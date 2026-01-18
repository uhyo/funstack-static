import { describe, it, expect } from "vitest";
import { computeContentHash } from "./contentHash";

describe("computeContentHash", () => {
  it("returns a 16-character hex string", async () => {
    const hash = await computeContentHash("test content");

    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("returns same hash for same content", async () => {
    const content = "identical content";

    const hash1 = await computeContentHash(content);
    const hash2 = await computeContentHash(content);

    expect(hash1).toBe(hash2);
  });

  it("returns different hash for different content", async () => {
    const hash1 = await computeContentHash("content A");
    const hash2 = await computeContentHash("content B");

    expect(hash1).not.toBe(hash2);
  });

  it("handles empty string", async () => {
    const hash = await computeContentHash("");

    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("handles unicode content", async () => {
    const hash = await computeContentHash("こんにちは世界 🌍");

    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("produces consistent hash for known input", async () => {
    // SHA-256 of "hello" starts with "2cf24dba5fb0a30e"
    const hash = await computeContentHash("hello");

    expect(hash).toBe("2cf24dba5fb0a30e");
  });
});

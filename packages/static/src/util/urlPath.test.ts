import { describe, it, expect } from "vitest";
import { urlPathToFileCandidates } from "./urlPath";

describe("urlPathToFileCandidates", () => {
  it('maps "/" to ["index.html"]', () => {
    expect(urlPathToFileCandidates("/")).toEqual(["index.html"]);
  });

  it('maps "" to ["index.html"]', () => {
    expect(urlPathToFileCandidates("")).toEqual(["index.html"]);
  });

  it('maps "/about" to ["about.html", "about/index.html"]', () => {
    expect(urlPathToFileCandidates("/about")).toEqual([
      "about.html",
      "about/index.html",
    ]);
  });

  it('maps "/blog/post-1" to ["blog/post-1.html", "blog/post-1/index.html"]', () => {
    expect(urlPathToFileCandidates("/blog/post-1")).toEqual([
      "blog/post-1.html",
      "blog/post-1/index.html",
    ]);
  });

  it("handles trailing slash", () => {
    expect(urlPathToFileCandidates("/about/")).toEqual([
      "about.html",
      "about/index.html",
    ]);
  });

  it("handles deeply nested paths", () => {
    expect(urlPathToFileCandidates("/a/b/c")).toEqual([
      "a/b/c.html",
      "a/b/c/index.html",
    ]);
  });
});

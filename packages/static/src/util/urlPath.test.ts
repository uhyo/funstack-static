import { describe, it, expect } from "vitest";
import { urlPathToFileCandidates } from "./urlPath";

describe("urlPathToFileCandidates", () => {
  it('maps "/" to ["index.html", "index.htm"]', () => {
    expect(urlPathToFileCandidates("/")).toEqual(["index.html", "index.htm"]);
  });

  it('maps "" to ["index.html", "index.htm"]', () => {
    expect(urlPathToFileCandidates("")).toEqual(["index.html", "index.htm"]);
  });

  it('maps "/about" to ["about.html", "about.htm", "about/index.html", "about/index.htm"]', () => {
    expect(urlPathToFileCandidates("/about")).toEqual([
      "about.html",
      "about.htm",
      "about/index.html",
      "about/index.htm",
    ]);
  });

  it('maps "/blog/post-1" to ["blog/post-1.html", "blog/post-1.htm", "blog/post-1/index.html", "blog/post-1/index.htm"]', () => {
    expect(urlPathToFileCandidates("/blog/post-1")).toEqual([
      "blog/post-1.html",
      "blog/post-1.htm",
      "blog/post-1/index.html",
      "blog/post-1/index.htm",
    ]);
  });

  it("handles trailing slash", () => {
    expect(urlPathToFileCandidates("/about/")).toEqual([
      "about.html",
      "about.htm",
      "about/index.html",
      "about/index.htm",
    ]);
  });

  it("handles deeply nested paths", () => {
    expect(urlPathToFileCandidates("/a/b/c")).toEqual([
      "a/b/c.html",
      "a/b/c.htm",
      "a/b/c/index.html",
      "a/b/c/index.htm",
    ]);
  });
});

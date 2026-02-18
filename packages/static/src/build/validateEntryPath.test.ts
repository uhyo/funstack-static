import { describe, it, expect } from "vitest";
import { validateEntryPath, checkDuplicatePaths } from "./validateEntryPath";

describe("validateEntryPath", () => {
  it("accepts valid paths", () => {
    expect(validateEntryPath("index.html")).toBeUndefined();
    expect(validateEntryPath("about.html")).toBeUndefined();
    expect(validateEntryPath("blog/post-1.html")).toBeUndefined();
    expect(validateEntryPath("blog/post-1/index.html")).toBeUndefined();
    expect(validateEntryPath("index.htm")).toBeUndefined();
    expect(validateEntryPath("about.htm")).toBeUndefined();
    expect(validateEntryPath("blog/post-1.htm")).toBeUndefined();
  });

  it("rejects paths not ending with .html or .htm", () => {
    expect(validateEntryPath("index")).toBeDefined();
    expect(validateEntryPath("page.txt")).toBeDefined();
  });

  it("rejects paths starting with /", () => {
    expect(validateEntryPath("/index.html")).toBeDefined();
    expect(validateEntryPath("/about.html")).toBeDefined();
  });
});

describe("checkDuplicatePaths", () => {
  it("returns undefined for unique paths", () => {
    expect(
      checkDuplicatePaths(["index.html", "about.html", "blog/post.html"]),
    ).toBeUndefined();
  });

  it("returns error for duplicate paths", () => {
    const error = checkDuplicatePaths([
      "index.html",
      "about.html",
      "index.html",
    ]);
    expect(error).toBeDefined();
    expect(error).toContain("index.html");
  });

  it("returns undefined for empty array", () => {
    expect(checkDuplicatePaths([])).toBeUndefined();
  });
});

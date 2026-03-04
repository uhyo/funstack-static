import { describe, expect, test } from "vitest";
import { generateSitemap, entryPathToUrlPath } from "./sitemap";

describe("entryPathToUrlPath", () => {
  test("converts index.html to /", () => {
    expect(entryPathToUrlPath("index.html")).toBe("/");
  });

  test("converts index.htm to /", () => {
    expect(entryPathToUrlPath("index.htm")).toBe("/");
  });

  test("converts about.html to /about", () => {
    expect(entryPathToUrlPath("about.html")).toBe("/about");
  });

  test("converts blog/post-1.html to /blog/post-1", () => {
    expect(entryPathToUrlPath("blog/post-1.html")).toBe("/blog/post-1");
  });

  test("converts blog/post-1/index.html to /blog/post-1", () => {
    expect(entryPathToUrlPath("blog/post-1/index.html")).toBe("/blog/post-1");
  });

  test("converts nested/deep/page.html to /nested/deep/page", () => {
    expect(entryPathToUrlPath("nested/deep/page.html")).toBe(
      "/nested/deep/page",
    );
  });
});

describe("generateSitemap", () => {
  test("generates valid XML for a single entry", () => {
    const result = generateSitemap("https://example.com", ["index.html"], "");
    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(result).toContain("<loc>https://example.com/</loc>");
    expect(result).toContain("</urlset>");
  });

  test("generates valid XML for multiple entries", () => {
    const result = generateSitemap(
      "https://example.com",
      ["index.html", "about.html", "blog/post-1.html"],
      "",
    );
    expect(result).toContain("<loc>https://example.com/</loc>");
    expect(result).toContain("<loc>https://example.com/about</loc>");
    expect(result).toContain("<loc>https://example.com/blog/post-1</loc>");
  });

  test("strips trailing slash from base URL", () => {
    const result = generateSitemap("https://example.com/", ["index.html"], "");
    expect(result).toContain("<loc>https://example.com/</loc>");
    expect(result).not.toContain("<loc>https://example.com//</loc>");
  });

  test("includes Vite base path", () => {
    const result = generateSitemap(
      "https://example.com",
      ["index.html", "about.html"],
      "/docs",
    );
    expect(result).toContain("<loc>https://example.com/docs/</loc>");
    expect(result).toContain("<loc>https://example.com/docs/about</loc>");
  });

  test("escapes XML special characters in URLs", () => {
    const result = generateSitemap(
      "https://example.com",
      ["page&more.html"],
      "",
    );
    expect(result).toContain("<loc>https://example.com/page&amp;more</loc>");
  });
});

import { describe, expect, it } from "vitest";
import { stripModulePreloads } from "./stripModulePreloads";

describe("stripModulePreloads", () => {
  it("removes modulepreload links and keeps everything else", () => {
    const html =
      '<head><link rel="stylesheet" href="/a.css"/>' +
      '<link rel="modulepreload" href="/assets/a.js" crossorigin="" fetchPriority="low"/>' +
      '<link rel="modulepreload" href="/assets/b.js" crossorigin=""/>' +
      "<title>t</title></head>";
    expect(stripModulePreloads(html)).toBe(
      '<head><link rel="stylesheet" href="/a.css"/><title>t</title></head>',
    );
  });

  it("leaves HTML without preloads untouched", () => {
    const html = "<html><body><p>hi</p></body></html>";
    expect(stripModulePreloads(html)).toBe(html);
  });
});

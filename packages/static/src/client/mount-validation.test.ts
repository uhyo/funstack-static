import { describe, expect, it } from "vitest";
import {
  collectDestructiveSiblings,
  describeNode,
  type ContainerLike,
  type NodeLike,
} from "./mount-validation";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;

function element(tagName: string): NodeLike {
  return {
    nodeType: ELEMENT_NODE,
    nodeName: tagName.toUpperCase(),
    textContent: "",
  };
}

function text(content: string): NodeLike {
  return {
    nodeType: TEXT_NODE,
    nodeName: "#text",
    textContent: content,
  };
}

function comment(content: string): NodeLike {
  return {
    nodeType: COMMENT_NODE,
    nodeName: "#comment",
    textContent: content,
  };
}

function container(...childNodes: NodeLike[]): ContainerLike {
  return {
    nodeType: ELEMENT_NODE,
    nodeName: "BODY",
    textContent: "",
    childNodes,
  };
}

const marker = element("span");

describe("collectDestructiveSiblings", () => {
  it("returns nothing when the marker is the only child", () => {
    expect(collectDestructiveSiblings(container(marker), marker)).toEqual([]);
  });

  it("ignores whitespace-only text nodes", () => {
    const c = container(text("\n  "), marker, text("\t\n"));
    expect(collectDestructiveSiblings(c, marker)).toEqual([]);
  });

  it("ignores comment nodes", () => {
    const c = container(comment("$"), marker, comment("/$"));
    expect(collectDestructiveSiblings(c, marker)).toEqual([]);
  });

  it("ignores script elements", () => {
    // the framework emits bootstrap / RSC payload scripts next to the marker
    const c = container(marker, element("script"), element("script"));
    expect(collectDestructiveSiblings(c, marker)).toEqual([]);
  });

  it("collects element siblings", () => {
    const header = element("header");
    const footer = element("footer");
    const c = container(header, marker, footer);
    expect(collectDestructiveSiblings(c, marker)).toEqual([header, footer]);
  });

  it("collects non-whitespace text siblings", () => {
    const greeting = text("Hello");
    const c = container(greeting, marker);
    expect(collectDestructiveSiblings(c, marker)).toEqual([greeting]);
  });

  it("collects siblings mixed with ignorable nodes", () => {
    const nav = element("nav");
    const c = container(
      text("\n"),
      nav,
      comment("x"),
      marker,
      element("script"),
    );
    expect(collectDestructiveSiblings(c, marker)).toEqual([nav]);
  });
});

describe("describeNode", () => {
  it("describes elements by tag name", () => {
    expect(describeNode(element("header"))).toBe("<header>");
  });

  it("describes text nodes by quoted content", () => {
    expect(describeNode(text("  Hello  "))).toBe('"Hello"');
  });

  it("truncates long text content", () => {
    expect(describeNode(text("a".repeat(50)))).toBe(`"${"a".repeat(30)}…"`);
  });
});

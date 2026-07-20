import { appMarkerPrefix } from "../rsc/marker";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/**
 * Structural subset of DOM Node used by the validation logic,
 * allowing unit tests to run without a DOM implementation.
 */
export interface NodeLike {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly textContent: string | null;
}

export interface ContainerLike extends NodeLike {
  readonly childNodes: Iterable<NodeLike>;
}

/**
 * Collects the container's child nodes that would be destroyed by mounting
 * the App into the container (React clears all existing children of the
 * container on the first render).
 *
 * Nodes that are safe to lose are excluded:
 * - the app marker itself
 * - whitespace-only text nodes
 * - non-element, non-text nodes (comments, doctypes, ...)
 * - `<script>` elements: the framework itself emits scripts next to the
 *   marker (bootstrap scripts, injected RSC payload chunks), and they have
 *   already executed by mount time
 */
export function collectDestructiveSiblings(
  container: ContainerLike,
  marker: NodeLike,
): NodeLike[] {
  return Array.from(container.childNodes).filter((node) => {
    if (node === marker) {
      return false;
    }
    switch (node.nodeType) {
      case ELEMENT_NODE:
        return node.nodeName !== "SCRIPT";
      case TEXT_NODE:
        return node.textContent !== null && node.textContent.trim() !== "";
      default:
        return false;
    }
  });
}

export function describeNode(node: NodeLike): string {
  if (node.nodeType === TEXT_NODE) {
    const text = (node.textContent ?? "").trim();
    return JSON.stringify(text.length > 30 ? `${text.slice(0, 30)}…` : text);
  }
  return `<${node.nodeName.toLowerCase()}>`;
}

/**
 * Finds the app marker element in the current document, if any.
 * Used in dev mode where the marker id is not passed to the client;
 * the served shell HTML is inspected before React replaces the document.
 */
export function findAppMarker(): Element | null {
  return document.querySelector(`[id^="${appMarkerPrefix}"]`);
}

/**
 * Warns when mounting the App into the marker's parent element would
 * destroy other content the Root component rendered there.
 */
export function warnIfDestructiveMount(appMarker: Element): void {
  const container = appMarker.parentElement;
  if (!container) {
    return;
  }
  const destroyed = collectDestructiveSiblings(container, appMarker);
  if (destroyed.length === 0) {
    return;
  }
  console.error(
    `[@funstack/static] The Root component renders other content next to {children} inside <${container.nodeName.toLowerCase()}>: ${destroyed
      .map(describeNode)
      .join(", ")}.\n` +
      "With `ssr: false`, the App is mounted into the parent element of {children}, " +
      "and React removes all other content from that element when the production build runs in the browser.\n" +
      "Make {children} the only content of its parent element in Root, move the content into the App, or enable `ssr: true`.\n" +
      "See https://static.funstack.work/learn/how-it-works#keep-children-alone-in-its-parent-element for details.",
  );
}

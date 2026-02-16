import { createElement } from "react";
import type { EntryDefinition } from "../entryDefinition";

/**
 * Resolves the root field of an EntryDefinition to a concrete React component.
 */
export async function resolveRoot(
  root: EntryDefinition["root"],
): Promise<React.ComponentType<{ children: React.ReactNode }>> {
  const module = typeof root === "function" ? await root() : await root;
  return module.default;
}

/**
 * Checks whether a value is an AppModule (has a `default` property that is a function).
 */
function isAppModule(
  value: unknown,
): value is { default: React.ComponentType } {
  return (
    typeof value === "object" &&
    value !== null &&
    "default" in value &&
    typeof (value as Record<string, unknown>).default === "function"
  );
}

/**
 * Resolves the app field of an EntryDefinition to a React node.
 */
export async function resolveApp(
  app: EntryDefinition["app"],
): Promise<React.ReactNode> {
  if (typeof app === "function") {
    // Lazy import: () => Promise<{ default: Component }>
    const module = await app();
    return createElement(module.default);
  }
  if (isAppModule(app)) {
    // Sync module object: { default: Component }
    return createElement(app.default);
  }
  // Could be a Promise<AppModule> or a ReactNode (including Promise<ReactNode>).
  // Await it and check the resolved value.
  const resolved = await app;
  if (isAppModule(resolved)) {
    return createElement(resolved.default);
  }
  // ReactNode (JSX of a server component, or a resolved ReactNode)
  return resolved;
}

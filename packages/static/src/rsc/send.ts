import { registerClientReference } from "@vitejs/plugin-rsc/rsc";
import type { FC } from "react";

export class SendRegistry {
  #registry = new Map<string, FC<{}>>();

  register(component: FC<{}>, id: string) {
    this.#registry.set(id, component);
  }

  get(id: string): FC<{}> | undefined {
    return this.#registry.get(id);
  }
}

export const sendRegistry = new SendRegistry();

const referenceIDMap = new WeakMap<FC<{}>, string>();

export function send(component: FC<{}>): FC<{}> {
  const existingID = referenceIDMap.get(component);
  if (existingID !== undefined) {
    // Already registered
    return component;
  }
  const id = crypto.randomUUID();
  const reference = registerClientReference(
    component,
    getModuleIDFor(id),
    "default",
  );
  referenceIDMap.set(component, id);
  sendRegistry.register(component, id);

  return reference;
}

function getModuleIDFor(id: string): string {
  return `/.funstack/rsc/${id}`;
}

export function extractIDFromModuleID(moduleID: string): string | undefined {
  const prefix = "/.funstack/rsc/";
  if (!moduleID.startsWith(prefix)) {
    return undefined;
  }
  return moduleID.slice(prefix.length);
}

"use client";

// Kept separate from `#rsc-client` because it depends on `@funstack/router`,
// an optional peer dependency. Only file-system routing imports this entry, so
// apps that don't use it never load the router (#203).
export { FsRouteSlot } from "../rsc-client/fsRouteSlot";

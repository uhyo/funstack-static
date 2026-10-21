"use client";
import { useRouteParams } from "@funstack/router";
import type { FsRouteObject } from "@funstack/static/fs-routes";

// A Client Component reading params through the route object. It renders to
// HTML at build time (the router matches the page's own URL) and is never
// hydrated.
export function LiveSlug({
  route,
}: {
  route: FsRouteObject<{ slug: string }>;
}) {
  const params = useRouteParams(route);
  return <p data-testid="live-slug">{params.slug}</p>;
}

"use client";
import { useRouteParams } from "@funstack/router";
import type { FsRouteObject } from "@funstack/static/fs-routes";

// A Client Component reading the params of the current URL through the route
// object; in an MPA this always equals the params the page was built with.
export function LiveSlug({
  route,
}: {
  route: FsRouteObject<{ slug: string }>;
}) {
  const params = useRouteParams(route);
  return <p data-testid="live-slug">{params.slug}</p>;
}

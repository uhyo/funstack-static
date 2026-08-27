"use client";
import { useRouteParams } from "@funstack/router";
import type { FsRouteObject } from "@funstack/static/fs-routes";

// A Client Component under a Server Component page reading the live params
// of the current URL through the route object.
export function LiveLang({
  route,
}: {
  route: FsRouteObject<{ lang: string }>;
}) {
  const params = useRouteParams(route);
  return <p data-testid="live-lang">{params.lang}</p>;
}

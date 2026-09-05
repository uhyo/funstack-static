"use client";
import { useRouteParams } from "@funstack/router";
import type { FsRouteObject } from "@funstack/static/fs-routes";

// A Client Component rendered by a Server Component page. It receives the
// page's route object and reads the *live* params of the URL currently shown
// through FUNSTACK Router's `useRouteParams` hook.
export function LiveSlug({
  route,
}: {
  route: FsRouteObject<{ slug: string }>;
}) {
  const params = useRouteParams(route);
  return (
    <p>
      Live <code>useRouteParams(route).slug</code> in a Client Component:{" "}
      <strong>{params.slug}</strong>
    </p>
  );
}

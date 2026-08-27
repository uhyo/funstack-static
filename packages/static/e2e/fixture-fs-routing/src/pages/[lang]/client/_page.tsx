"use client";
import { useRouteParams } from "@funstack/router";
import type { FsRouteComponentProps } from "@funstack/static/fs-routes";

// A Client Component page: the router renders it with the live params of the
// current match (and its route object), so it stays correct across soft
// client-side navigation.
export default function ClientLangPage({
  params,
  route,
}: FsRouteComponentProps<{ lang: string }>) {
  const liveParams = useRouteParams(route);
  return (
    <div>
      <p data-testid="page-id">lang-client</p>
      <p data-testid="client-page-lang">{params.lang}</p>
      <p data-testid="client-page-hook-lang">{liveParams.lang}</p>
      <a href="/en/client" data-testid="link-en-client">
        English client page
      </a>{" "}
      <a href="/ja/client" data-testid="link-ja-client">
        Japanese client page
      </a>
    </div>
  );
}

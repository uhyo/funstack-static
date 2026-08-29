import { Outlet } from "@funstack/router";
import type { FsRouteComponentProps } from "@funstack/static/fs-routes";

// A Server Component layout under a dynamic segment: its output is
// pre-rendered per lang and swapped in on soft client-side navigation.
export default function InfoLayout({
  params,
}: FsRouteComponentProps<{ lang: string }>) {
  return (
    <section>
      <p data-testid="info-layout-lang">{params.lang}</p>
      <Outlet />
    </section>
  );
}

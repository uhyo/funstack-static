"use client";
import { Outlet, useLocation } from "@funstack/router";

// A Client Component layout under a dynamic segment: the router renders it
// with the params of the current match, so `params` stays live across soft
// client-side navigation.
export default function LangLayout({ params }: { params: { lang: string } }) {
  const location = useLocation();
  return (
    <section>
      <p data-testid="lang-layout-pathname">{location.pathname}</p>
      <p data-testid="lang-layout-lang">{params.lang}</p>
      <Outlet />
    </section>
  );
}

"use client";
import { Outlet, useLocation } from "@funstack/router";

// A Client Component layout under a dynamic segment, rendered to HTML with
// the params of the page being generated.
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

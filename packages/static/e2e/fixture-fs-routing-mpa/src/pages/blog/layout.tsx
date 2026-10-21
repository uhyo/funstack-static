import { Outlet } from "@funstack/router";

// A Server Component layout: `<Outlet />` from FUNSTACK Router works while
// rendering to HTML even though no router runs in the browser.
export default function BlogLayout() {
  return (
    <section>
      <p data-testid="blog-layout">blog-layout</p>
      <Outlet />
    </section>
  );
}

import { Outlet } from "@funstack/router";

// A Server Component layout: `blog/layout.tsx` wraps every page under
// `blog/`. It renders `<Outlet />` where the matched child page should
// appear. In MPA mode the layout is rendered anew with each page's document;
// there is no shared layout instance persisting across navigations.
export default function BlogLayout() {
  return (
    <section>
      <p>
        <small>
          Everything below is wrapped by <code>pages/blog/layout.tsx</code>.
        </small>
      </p>
      <Outlet />
    </section>
  );
}

import { Outlet } from "@funstack/router";

// A Server Component layout: `blog/layout.tsx` wraps every page under
// `blog/` (the index, `/blog/featured`, and each `/blog/:slug`). It renders
// `<Outlet />` where the matched child page should appear.
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

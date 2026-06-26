export default function Blog() {
  return (
    <div>
      <h1>Blog</h1>
      <p>
        This page is at <code>pages/blog/page.tsx</code>, which maps to the{" "}
        <code>/blog</code> route.
      </p>
      <p>
        Nested directories create nested URL paths. A <code>layout.tsx</code>{" "}
        file in a directory wraps its pages (render{" "}
        <code>&lt;Outlet /&gt;</code> where children should appear).
      </p>
    </div>
  );
}

import type { RouteDefinition } from "@funstack/router/server";

export default function Blog({ route }: { route: RouteDefinition }) {
  return (
    <div>
      <h1>Blog</h1>
      <p>
        This page is at <code>pages/blog/index.tsx</code>, which maps to the{" "}
        <code>/blog</code> route.
      </p>
      <p>
        Nested directories create nested URL paths. An <code>index.tsx</code>{" "}
        file in a directory maps to the directory&apos;s path.
      </p>
    </div>
  );
}

"use client";
import { useSearchParams } from "@funstack/router";
import type { Post } from "./posts";

// FUNSTACK Router's hooks that read the location work under `<RouteDisplay>`
// just as under `<Router>`. Setters that navigate, such as the one returned by
// `useSearchParams`, perform a full page navigation in MPA mode: changing the
// sort order below reloads `/blog?sort=…`, and this component renders the
// new order from the URL of the freshly loaded document.
export function SortControl({ posts }: { posts: Post[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const descending = searchParams.get("sort") === "desc";
  const sorted = descending ? [...posts].reverse() : posts;
  return (
    <div>
      <p>
        Order:{" "}
        <button
          type="button"
          onClick={() => setSearchParams({ sort: descending ? "asc" : "desc" })}
        >
          {descending ? "newest first" : "oldest first"} (switch)
        </button>
      </p>
      <ul>
        {sorted.map((post) => (
          <li key={post.slug}>
            <a href={`/blog/${post.slug}`}>{post.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

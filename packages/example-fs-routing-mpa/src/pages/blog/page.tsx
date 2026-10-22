import { posts } from "./posts";
import { SortControl } from "./sort-control";

// A Server Component page listing the posts. The sort order comes from the
// URL's query string, which a Client Component reads and changes; see
// `sort-control.tsx` for how that works without client-side routing.
export default function Blog() {
  return (
    <div>
      <h1>Blog</h1>
      <p>
        This page is at <code>pages/blog/page.tsx</code>, which maps to the{" "}
        <code>/blog</code> route. The posts below live at{" "}
        <code>pages/blog/[slug]/page.tsx</code>, a dynamic route.
      </p>
      <SortControl posts={posts} />
    </div>
  );
}

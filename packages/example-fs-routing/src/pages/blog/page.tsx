import { posts } from "./posts";

export default function Blog() {
  return (
    <div>
      <h1>Blog</h1>
      <p>
        This page is at <code>pages/blog/page.tsx</code>, which maps to the{" "}
        <code>/blog</code> route. The posts below live at{" "}
        <code>pages/blog/[slug]/page.tsx</code>, a dynamic route.
      </p>
      <ul>
        {posts.map((post) => (
          <li key={post.slug}>
            <a href={`/blog/${post.slug}`}>{post.title}</a>
          </li>
        ))}
        <li>
          <a href="/blog/featured">Featured posts</a> (a static page next to the
          dynamic route)
        </li>
      </ul>
    </div>
  );
}

import { posts } from "../posts";

// Route precedence: `blog/featured/page.tsx` is a static sibling of
// `blog/[slug]/page.tsx`. Static segments match before dynamic segments, so
// `/blog/featured` renders this page while every other `/blog/…` URL falls
// through to the dynamic one.
//
// Note that `generateStaticParams()` in `[slug]/page.tsx` must not return
// `{ slug: "featured" }`: two different pages generating the same URL fail the
// build, since one of them could never be reached.
export default function FeaturedPosts() {
  const featured = posts.slice(0, 2);
  return (
    <div>
      <h1>Featured Posts</h1>
      <p>
        This is <code>pages/blog/featured/page.tsx</code>, a <em>static</em>{" "}
        route that takes precedence over the dynamic{" "}
        <code>pages/blog/[slug]/page.tsx</code> for the URL{" "}
        <code>/blog/featured</code>.
      </p>
      <ul>
        {featured.map((post) => (
          <li key={post.slug}>
            <a href={`/blog/${post.slug}`}>{post.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

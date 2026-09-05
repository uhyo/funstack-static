import type { FsRouteComponentProps } from "@funstack/static/fs-routes";
import { getPost, posts } from "../posts";
import { LiveSlug } from "./live-slug";

// A dynamic route must enumerate its pages at build time. Each returned
// object becomes one pre-rendered page: `/blog/hello`, `/blog/static-generation`, …
//
// Returning the same params twice is harmless (duplicates are collapsed), but
// returning a value that collides with a sibling static page (`"featured"`)
// or that cannot round-trip through the URL (an empty string, or one
// containing `/`, `?`, `#`, `.` or `..` segments) fails the build.
export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

// A Server Component page. It is rendered once per params combination at
// build time, and `params` is the combination this output was generated for.
//
// On soft client-side navigation between posts, the destination's
// pre-rendered output is fetched as a static RSC chunk and swapped in, so
// `params.slug` (and the whole post) always matches the URL shown.
export default function BlogPost({
  params,
  route,
}: FsRouteComponentProps<{ slug: string }>) {
  const post = getPost(params.slug);
  const index = posts.findIndex((p) => p.slug === params.slug);
  const prev = posts[index - 1];
  const next = posts[index + 1];

  return (
    <article>
      <h1>{post?.title ?? "Unknown post"}</h1>
      <p>
        Build-time <code>params.slug</code> in a Server Component:{" "}
        <strong>{params.slug}</strong>
      </p>
      <LiveSlug route={route} />
      <p>{post?.body}</p>
      <p>
        Follow the links below: the page is not reloaded, yet both values above
        update to the new post.
      </p>
      <p>
        {prev ? <a href={`/blog/${prev.slug}`}>← {prev.title}</a> : null}
        {prev && next ? " | " : null}
        {next ? <a href={`/blog/${next.slug}`}>{next.title} →</a> : null}
      </p>
      <p>
        <a href="/blog">Back to the blog index</a>
      </p>
    </article>
  );
}

import type { FsRouteComponentProps } from "@funstack/static/fs-routes";
import { getPost, posts } from "../posts";

// A dynamic route must enumerate its pages at build time. Each returned
// object becomes one pre-rendered page: `/blog/hello`, `/blog/static-generation`, …
export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

// A Server Component page, rendered once per params combination at build
// time. In MPA mode the document never outlives its URL, so `params` always
// matches the URL shown: there is no need for the route object and
// `useRouteParams` to read "live" params, as the SPA example does.
export default function BlogPost({
  params,
}: FsRouteComponentProps<{ slug: string }>) {
  const post = getPost(params.slug);
  const index = posts.findIndex((p) => p.slug === params.slug);
  const prev = posts[index - 1];
  const next = posts[index + 1];

  return (
    <article>
      <h1>{post?.title ?? "Unknown post"}</h1>
      <p>
        <code>params.slug</code> of this page: <strong>{params.slug}</strong>
      </p>
      <p>{post?.body}</p>
      <p>Follow the links below: each post is loaded as its own document.</p>
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

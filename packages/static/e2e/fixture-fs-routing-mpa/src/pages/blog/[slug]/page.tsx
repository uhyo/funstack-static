import type { FsRouteComponentProps } from "@funstack/static/fs-routes";
import { LiveSlug } from "./live-slug";

export function generateStaticParams() {
  return [{ slug: "hello" }, { slug: "world" }];
}

// A Server Component page: rendered at build time with the concrete params.
export default function BlogPost({
  params,
  route,
}: FsRouteComponentProps<{ slug: string }>) {
  return (
    <div>
      <h1>Blog Post</h1>
      <p data-testid="page-id">blog-post</p>
      <p data-testid="slug">{params.slug}</p>
      <LiveSlug route={route} />
      <a href="/blog/world" data-testid="link-world">
        World post
      </a>
    </div>
  );
}

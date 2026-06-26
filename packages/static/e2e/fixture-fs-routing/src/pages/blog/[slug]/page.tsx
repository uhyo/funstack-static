export function generateStaticParams() {
  return [{ slug: "hello" }, { slug: "world" }];
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  return (
    <div>
      <h1>Blog Post</h1>
      <p data-testid="page-id">blog-post</p>
      <p data-testid="slug">{params.slug}</p>
    </div>
  );
}

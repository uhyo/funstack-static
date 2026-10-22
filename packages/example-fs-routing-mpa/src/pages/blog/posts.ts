// Shared data for the blog routes. This file is neither `page.tsx` nor
// `layout.tsx`, so the adapter ignores it: helpers can be co-located with
// routes.
export interface Post {
  slug: string;
  title: string;
  body: string;
}

export const posts: Post[] = [
  {
    slug: "hello",
    title: "Hello, World",
    body: "The first post. Each post is a page of the dynamic `/blog/:slug` route, pre-rendered at build time.",
  },
  {
    slug: "static-generation",
    title: "Static Generation",
    body: "A static site can only serve pages that exist at build time, so dynamic routes enumerate their params with generateStaticParams().",
  },
  {
    slug: "full-page-loads",
    title: "Full Page Loads",
    body: "Following a link between posts loads the destination's own HTML. There is no soft navigation, so no RSC chunk is fetched and nothing from the previous page is kept.",
  },
];

export function getPost(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug);
}

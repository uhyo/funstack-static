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
    slug: "soft-navigation",
    title: "Soft Navigation",
    body: "Following a link between posts does not reload the page. The destination's pre-rendered output is fetched and swapped in instead.",
  },
];

export function getPost(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug);
}

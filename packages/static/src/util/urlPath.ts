/**
 * Maps a URL path to candidate file names for matching against entry paths.
 *
 * - `/` → `["index.html", "index.htm"]`
 * - `/about` → `["about.html", "about.htm", "about/index.html", "about/index.htm"]`
 * - `/blog/post-1` → `["blog/post-1.html", "blog/post-1.htm", "blog/post-1/index.html", "blog/post-1/index.htm"]`
 */
export function urlPathToFileCandidates(urlPath: string): string[] {
  if (urlPath === "/" || urlPath === "") {
    return ["index.html", "index.htm"];
  }
  const stripped = urlPath.replace(/^\//, "").replace(/\/$/, "");
  return [
    `${stripped}.html`,
    `${stripped}.htm`,
    `${stripped}/index.html`,
    `${stripped}/index.htm`,
  ];
}

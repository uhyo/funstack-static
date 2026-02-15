/**
 * Maps a URL path to candidate file names for matching against entry paths.
 *
 * - `/` → `["index.html"]`
 * - `/about` → `["about.html", "about/index.html"]`
 * - `/blog/post-1` → `["blog/post-1.html", "blog/post-1/index.html"]`
 */
export function urlPathToFileCandidates(urlPath: string): string[] {
  if (urlPath === "/" || urlPath === "") {
    return ["index.html"];
  }
  const stripped = urlPath.replace(/^\//, "").replace(/\/$/, "");
  return [`${stripped}.html`, `${stripped}/index.html`];
}

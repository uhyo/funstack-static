/**
 * Generates a sitemap.xml string from a list of entry paths and a base URL.
 *
 * @param baseUrl - The base URL of the site (e.g. "https://example.com")
 * @param entryPaths - The list of entry file paths (e.g. ["index.html", "about.html", "blog/post-1.html"])
 * @param base - The Vite base path (e.g. "" or "/subpath")
 * @returns The sitemap XML string
 */
export function generateSitemap(
  baseUrl: string,
  entryPaths: string[],
  base: string,
): string {
  // Normalize: remove trailing slash from baseUrl
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  const urls = entryPaths.map((entryPath) => {
    const urlPath = entryPathToUrlPath(entryPath);
    const fullUrl = `${normalizedBaseUrl}${base}${urlPath}`;
    return `  <url>\n    <loc>${escapeXml(fullUrl)}</loc>\n  </url>`;
  });

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

/**
 * Converts an entry file path to a clean URL path.
 * - "index.html" → "/"
 * - "about.html" → "/about"
 * - "blog/post-1.html" → "/blog/post-1"
 * - "blog/post-1/index.html" → "/blog/post-1"
 */
export function entryPathToUrlPath(entryPath: string): string {
  // Remove .html or .htm extension
  let urlPath = entryPath.replace(/\.(html|htm)$/, "");

  // Remove trailing /index
  urlPath = urlPath.replace(/\/index$/, "");

  // Handle root index
  if (urlPath === "index") {
    return "/";
  }

  return "/" + urlPath;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

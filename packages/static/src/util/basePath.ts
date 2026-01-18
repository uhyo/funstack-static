/**
 * Strips the base path from a pathname if present.
 * Used on server-side to normalize incoming request paths.
 */
export function stripBasePath(pathname: string): string {
  const base = import.meta.env.BASE_URL;
  if (base === "/") return pathname;
  // Handle base with or without trailing slash
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  if (pathname.startsWith(normalizedBase)) {
    const stripped = pathname.slice(normalizedBase.length);
    return stripped.startsWith("/") ? stripped : "/" + stripped;
  }
  return pathname;
}

/**
 * Prepends the base path to a path.
 * Used on client-side when making fetch requests.
 */
export function withBasePath(path: string): string {
  const base = import.meta.env.BASE_URL;
  if (base === "/") return path;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return normalizedBase + path;
}

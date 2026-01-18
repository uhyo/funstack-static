// Parsed request information used to route between RSC/SSR rendering and action handling.
// Created by parseRenderRequest() from incoming HTTP requests.
type RenderRequest = {
  isRsc: boolean; // true if request should return RSC payload (via _.rsc suffix)
  request: Request; // normalized Request with _.rsc suffix removed from URL
  url: URL; // normalized URL with _.rsc suffix removed
};

/**
 * Path of RSC stream endpoint in development environment.
 */
export const devMainRscPath = "/.funstack/rsc";

export function parseRenderRequest(request: Request): RenderRequest {
  const url = new URL(request.url);
  if (url.pathname === devMainRscPath) {
    return {
      isRsc: true,
      request: new Request(url, request),
      url,
    };
  } else {
    return {
      isRsc: false,
      request,
      url,
    };
  }
}

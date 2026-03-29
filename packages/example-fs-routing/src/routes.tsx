import { route, type RouteDefinition } from "@funstack/router/server";

const pageModules = import.meta.glob<{ default: React.ComponentType }>(
  "./pages/**/*.tsx",
  { eager: true },
);

function filePathToUrlPath(filePath: string): string {
  let urlPath = filePath.replace(/^\.\/pages/, "").replace(/\.tsx$/, "");
  if (urlPath.endsWith("/index")) {
    urlPath = urlPath.slice(0, -"/index".length);
  }
  return urlPath || "/";
}

export const routes: RouteDefinition[] = Object.entries(pageModules).map(
  ([filePath, module]) => {
    return route({
      path: filePathToUrlPath(filePath),
      component: module.default,
    });
  },
);

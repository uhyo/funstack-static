import type { EntryDefinition } from "@funstack/static/entries";
import type { RouteDefinition } from "@funstack/router/server";
import App, { routes } from "./App";

function collectPaths(routes: RouteDefinition[]): string[] {
  const paths: string[] = [];
  for (const route of routes) {
    if (route.children) {
      paths.push(...collectPaths(route.children));
    } else if (route.path !== undefined && route.path !== "*") {
      paths.push(route.path);
    }
  }
  return paths;
}

function pathToEntryPath(path: string): string {
  if (path === "/") return "index.html";
  return `${path.slice(1)}.html`;
}

export default function getEntries(): EntryDefinition[] {
  return collectPaths(routes).map((pathname) => ({
    path: pathToEntryPath(pathname),
    root: () => import("./root"),
    app: <App ssrPath={pathname} />,
  }));
}

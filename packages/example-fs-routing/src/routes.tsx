import {
  route,
  bindRoute,
  type RouteDefinition,
} from "@funstack/router/server";

const pageModules = import.meta.glob<{
  default: React.ComponentType<{ route: RouteDefinition }>;
}>("./pages/**/*.tsx", { eager: true });

function filePathToUrlPath(filePath: string): string {
  let urlPath = filePath.replace(/^\.\/pages/, "").replace(/\.tsx$/, "");
  if (urlPath.endsWith("/index")) {
    urlPath = urlPath.slice(0, -"/index".length);
  }
  return urlPath || "/";
}

export const routes: RouteDefinition[] = Object.entries(pageModules).map(
  ([filePath, module]) => {
    const Page = module.default;
    const partialRoute = route({
      path: filePathToUrlPath(filePath),
    });
    return bindRoute(partialRoute, {
      component: <Page route={partialRoute} />,
    });
  },
);

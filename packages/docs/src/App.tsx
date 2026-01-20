import { Outlet } from "@funstack/router";
import { route, type RouteDefinition } from "@funstack/router/server";
import { defer } from "@funstack/static/server";
import { Layout } from "./components/Layout/Layout";
import DeferApi from "./pages/api/Defer.mdx";
import FunstackStaticApi from "./pages/api/FunstackStatic.mdx";
import RSCConcept from "./pages/concepts/RSC.mdx";
import GettingStarted from "./pages/GettingStarted.mdx";
import { Home } from "./pages/Home";
import { Router } from "./Router";

const routes: RouteDefinition[] = [
  route({
    path: import.meta.env.BASE_URL.replace(/\/$/, ""),
    component: <Outlet />,
    children: [
      route({
        path: "/",
        component: (
          <Layout variant="home">
            <Home />
          </Layout>
        ),
      }),
      route({
        path: "/getting-started",
        component: <Layout>{defer(GettingStarted)}</Layout>,
      }),
      route({
        path: "/api/funstack-static",
        component: <Layout>{defer(FunstackStaticApi)}</Layout>,
      }),
      route({
        path: "/api/defer",
        component: <Layout>{defer(DeferApi)}</Layout>,
      }),
      route({
        path: "/concepts/rsc",
        component: <Layout>{defer(RSCConcept)}</Layout>,
      }),
    ],
  }),
];

export default function App() {
  return <Router routes={routes} fallback="static" />;
}

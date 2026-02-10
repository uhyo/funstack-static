import { Outlet } from "@funstack/router";
import { route, type RouteDefinition } from "@funstack/router/server";
import { defer } from "@funstack/static/server";
import { Layout } from "./components/Layout/Layout";
import DeferApi from "./pages/api/Defer.mdx";
import FunstackStaticApi from "./pages/api/FunstackStatic.mdx";
import HowItWorks from "./pages/learn/HowItWorks.mdx";
import LazyServerComponents from "./pages/learn/LazyServerComponents.mdx";
import OptimizingPayloads from "./pages/learn/OptimizingPayloads.mdx";
import RSCConcept from "./pages/learn/RSC.mdx";
import DeferAndActivity from "./pages/learn/DeferAndActivity.mdx";
import SSR from "./pages/learn/SSR.mdx";
import FAQ from "./pages/FAQ.mdx";
import GettingStarted from "./pages/GettingStarted.mdx";
import MigratingFromViteSPA from "./pages/MigratingFromViteSPA.mdx";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
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
        component: (
          <Layout>
            {defer(<GettingStarted />, { name: "GettingStarted" })}
          </Layout>
        ),
      }),
      route({
        path: "/getting-started/migrating-from-vite-spa",
        component: (
          <Layout>
            {defer(<MigratingFromViteSPA />, { name: "MigratingFromViteSPA" })}
          </Layout>
        ),
      }),
      route({
        path: "/faq",
        component: <Layout>{defer(<FAQ />, { name: "FAQ" })}</Layout>,
      }),
      route({
        path: "/api/funstack-static",
        component: (
          <Layout>
            {defer(<FunstackStaticApi />, { name: "FunstackStaticApi" })}
          </Layout>
        ),
      }),
      route({
        path: "/api/defer",
        component: <Layout>{defer(<DeferApi />, { name: "DeferApi" })}</Layout>,
      }),
      route({
        path: "/learn/how-it-works",
        component: (
          <Layout>{defer(<HowItWorks />, { name: "HowItWorks" })}</Layout>
        ),
      }),
      route({
        path: "/learn/rsc",
        component: (
          <Layout>{defer(<RSCConcept />, { name: "RSCConcept" })}</Layout>
        ),
      }),
      route({
        path: "/learn/optimizing-payloads",
        component: (
          <Layout>
            {defer(<OptimizingPayloads />, { name: "OptimizingPayloads" })}
          </Layout>
        ),
      }),
      route({
        path: "/learn/lazy-server-components",
        component: (
          <Layout>
            {defer(<LazyServerComponents />, { name: "LazyServerComponents" })}
          </Layout>
        ),
      }),
      route({
        path: "/learn/defer-and-activity",
        component: (
          <Layout>
            {defer(<DeferAndActivity />, { name: "DeferAndActivity" })}
          </Layout>
        ),
      }),
      route({
        path: "/learn/ssr",
        component: <Layout>{defer(<SSR />, { name: "SSR" })}</Layout>,
      }),
      route({
        path: "*",
        component: (
          <Layout>
            <NotFound />
          </Layout>
        ),
      }),
    ],
  }),
];

export default function App() {
  return <Router routes={routes} fallback="static" />;
}

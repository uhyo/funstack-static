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
import FileSystemRouting from "./pages/learn/FileSystemRouting.mdx";
import MultipleEntrypoints from "./pages/advanced/MultipleEntrypoints.mdx";
import SSR from "./pages/advanced/SSR.mdx";
import BuildEntryApi from "./pages/api/BuildEntry.mdx";
import EntryDefinitionApi from "./pages/api/EntryDefinition.mdx";
import FAQ from "./pages/FAQ.mdx";
import GettingStarted from "./pages/GettingStarted.mdx";
import MigratingFromViteSPA from "./pages/MigratingFromViteSPA.mdx";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { Router } from "./Router";

export const routes: RouteDefinition[] = [
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
          <Layout title="Getting Started">
            {defer(<GettingStarted />, { name: "GettingStarted" })}
          </Layout>
        ),
      }),
      route({
        path: "/getting-started/migrating-from-vite-spa",
        component: (
          <Layout title="Migrating from Vite SPA">
            {defer(<MigratingFromViteSPA />, { name: "MigratingFromViteSPA" })}
          </Layout>
        ),
      }),
      route({
        path: "/faq",
        component: (
          <Layout title="FAQ">{defer(<FAQ />, { name: "FAQ" })}</Layout>
        ),
      }),
      route({
        path: "/api/funstack-static",
        component: (
          <Layout title="funstackStatic()">
            {defer(<FunstackStaticApi />, { name: "FunstackStaticApi" })}
          </Layout>
        ),
      }),
      route({
        path: "/api/defer",
        component: (
          <Layout title="defer()">
            {defer(<DeferApi />, { name: "DeferApi" })}
          </Layout>
        ),
      }),
      route({
        path: "/api/build-entry",
        component: (
          <Layout title="BuildEntryFunction">
            {defer(<BuildEntryApi />, { name: "BuildEntryApi" })}
          </Layout>
        ),
      }),
      route({
        path: "/api/entry-definition",
        component: (
          <Layout title="EntryDefinition">
            {defer(<EntryDefinitionApi />, { name: "EntryDefinitionApi" })}
          </Layout>
        ),
      }),
      route({
        path: "/learn/how-it-works",
        component: (
          <Layout title="How It Works">
            {defer(<HowItWorks />, { name: "HowItWorks" })}
          </Layout>
        ),
      }),
      route({
        path: "/learn/rsc",
        component: (
          <Layout title="React Server Components">
            {defer(<RSCConcept />, { name: "RSCConcept" })}
          </Layout>
        ),
      }),
      route({
        path: "/learn/optimizing-payloads",
        component: (
          <Layout title="Optimizing RSC Payloads">
            {defer(<OptimizingPayloads />, { name: "OptimizingPayloads" })}
          </Layout>
        ),
      }),
      route({
        path: "/learn/lazy-server-components",
        component: (
          <Layout title="Using lazy() in Server Components">
            {defer(<LazyServerComponents />, { name: "LazyServerComponents" })}
          </Layout>
        ),
      }),
      route({
        path: "/learn/defer-and-activity",
        component: (
          <Layout title="Prefetching with defer() and Activity">
            {defer(<DeferAndActivity />, { name: "DeferAndActivity" })}
          </Layout>
        ),
      }),
      route({
        path: "/learn/file-system-routing",
        component: (
          <Layout title="File-System Routing">
            {defer(<FileSystemRouting />, { name: "FileSystemRouting" })}
          </Layout>
        ),
      }),
      route({
        path: "/advanced/multiple-entrypoints",
        component: (
          <Layout title="Multiple Entrypoints (SSG)">
            {defer(<MultipleEntrypoints />, { name: "MultipleEntrypoints" })}
          </Layout>
        ),
      }),
      route({
        path: "/advanced/ssr",
        component: (
          <Layout title="Server-Side Rendering">
            {defer(<SSR />, { name: "SSR" })}
          </Layout>
        ),
      }),
      route({
        path: "*",
        component: (
          <Layout title="Not Found">
            <NotFound />
          </Layout>
        ),
      }),
    ],
  }),
];

export default function App({ ssrPath }: { ssrPath: string }) {
  return <Router routes={routes} fallback="static" ssr={{ path: ssrPath }} />;
}

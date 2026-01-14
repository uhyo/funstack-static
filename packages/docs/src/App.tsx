import { Router } from "@funstack/router";
import { route, type RouteDefinition } from "@funstack/router/server";
import GettingStarted from "./pages/GettingStarted.mdx";
import { Home } from "./pages/Home";

const routes: RouteDefinition[] = [
  route({
    path: "/",
    component: <Home />,
  }),
  route({
    path: "/getting-started",
    component: <GettingStarted />,
  }),
];

export default function App() {
  return <Router routes={routes} />;
}

import { Router } from "@funstack/router";
import { routes } from "./routes";

export default function App({ ssrPath }: { ssrPath: string }) {
  return <Router routes={routes} fallback="static" ssr={{ path: ssrPath }} />;
}

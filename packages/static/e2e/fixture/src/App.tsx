import { defer } from "@funstack/static/entries/rsc";
import { Counter } from "./Counter";
import DeferredSection from "./DeferredSection";
import IdProbe from "./IdProbe";

export default function App() {
  const deferred = defer(<DeferredSection />, { name: "DeferredSection" });
  return (
    <main>
      <h1>E2E Test App</h1>
      <p data-testid="server-rendered">Server rendered content</p>
      <Counter />
      <IdProbe label="main" />
      {deferred}
      <IdProbe label="main-after" />
    </main>
  );
}

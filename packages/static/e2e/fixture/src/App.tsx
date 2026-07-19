import { defer } from "@funstack/static/entries/rsc";
import { Counter } from "./Counter";
import DeferredSection from "./DeferredSection";

export default function App() {
  const deferred = defer(<DeferredSection />, { name: "DeferredSection" });
  return (
    <main>
      <h1>E2E Test App</h1>
      <p data-testid="server-rendered">Server rendered content</p>
      <Counter />
      {deferred}
    </main>
  );
}

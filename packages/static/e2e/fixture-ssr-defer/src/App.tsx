import { defer } from "@funstack/static/entries/rsc";
import DeferredContent from "./DeferredContent";

export default function App() {
  const deferred = defer(<DeferredContent />, { name: "DeferredContent" });
  return (
    <main>
      <h1>SSR Defer Test</h1>
      <p data-testid="server-rendered">Server rendered content</p>
      {deferred}
    </main>
  );
}

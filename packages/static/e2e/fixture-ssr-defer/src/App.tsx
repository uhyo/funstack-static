import { defer } from "@funstack/static/entries/rsc";
import DeferredContent from "./DeferredContent";
import IdProbe from "./IdProbe";

export default function App() {
  const deferred = defer(<DeferredContent />, { name: "DeferredContent" });
  return (
    <main>
      <h1>SSR Defer Test</h1>
      <p data-testid="server-rendered">Server rendered content</p>
      <IdProbe label="main-1" />
      {deferred}
      <IdProbe label="main-2" />
    </main>
  );
}

import { defer } from "@funstack/static/entries/rsc";
import IdProbe from "./IdProbe";
import NestedDeferredContent from "./NestedDeferredContent";

export default function DeferredContent() {
  const nested = defer(<NestedDeferredContent />, {
    name: "NestedDeferredContent",
  });
  return (
    <>
      <p data-testid="deferred-content">Hello from deferred component</p>
      <IdProbe label="deferred-1" />
      <IdProbe label="deferred-2" />
      {nested}
    </>
  );
}

import { defer } from "@funstack/static/entries/rsc";
import NestedDeferredContent from "./NestedDeferredContent";

export default function DeferredContent() {
  const nested = defer(<NestedDeferredContent />, {
    name: "NestedDeferredContent",
  });
  return (
    <>
      <p data-testid="deferred-content">Hello from deferred component</p>
      {nested}
    </>
  );
}

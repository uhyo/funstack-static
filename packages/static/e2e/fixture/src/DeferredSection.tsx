import { defer } from "@funstack/static/entries/rsc";
import NestedDeferredSection from "./NestedDeferredSection";

export default function DeferredSection() {
  const nested = defer(<NestedDeferredSection />, {
    name: "NestedDeferredSection",
  });
  return (
    <>
      <p data-testid="deferred-section">Deferred section content</p>
      {nested}
    </>
  );
}

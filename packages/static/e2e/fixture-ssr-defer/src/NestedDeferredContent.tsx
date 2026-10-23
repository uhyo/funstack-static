import IdProbe from "./IdProbe";

export default function NestedDeferredContent() {
  return (
    <>
      <p data-testid="nested-deferred-content">
        Hello from nested deferred component
      </p>
      <IdProbe label="nested-1" />
    </>
  );
}

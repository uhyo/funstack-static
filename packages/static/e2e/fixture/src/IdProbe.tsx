import { useId } from "react";

/**
 * Renders a server-side `useId()` value as both the element id and a data
 * attribute, so tests can check that ids from different payloads differ.
 */
export default function IdProbe({ label }: { label: string }) {
  const id = useId();
  return (
    <p data-testid={`id-probe-${label}`} data-probe-id={id} id={id}>
      {id}
    </p>
  );
}

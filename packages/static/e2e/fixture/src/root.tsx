import { useId } from "react";

export default function Root({ children }: { children: React.ReactNode }) {
  // A server useId() in the Root shell; must not collide with the App's.
  const id = useId();
  return (
    <html lang="en" data-probe-id={id}>
      <head>
        <meta charSet="UTF-8" />
        <title>E2E Test Fixture</title>
      </head>
      <body>{children}</body>
    </html>
  );
}

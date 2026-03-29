import type { RouteDefinition } from "@funstack/router/server";

export default function About({ route }: { route: RouteDefinition }) {
  return (
    <div>
      <h1>About</h1>
      <p>
        This example demonstrates file-system routing with{" "}
        <a href="https://github.com/uhyo/funstack-static">FUNSTACK Static</a>.
      </p>
      <p>
        Routes are derived from the file structure under <code>src/pages/</code>{" "}
        using Vite&apos;s <code>import.meta.glob</code>, which also enables hot
        module replacement during development.
      </p>
    </div>
  );
}

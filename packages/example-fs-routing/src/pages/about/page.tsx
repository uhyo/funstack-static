export default function About() {
  return (
    <div>
      <h1>About</h1>
      <p>
        This example demonstrates the built-in file-system routing of{" "}
        <a href="https://github.com/uhyo/funstack-static">FUNSTACK Static</a>.
      </p>
      <p>
        Routes are derived from the file structure under <code>src/pages/</code>{" "}
        using the Next.js-like adapter, and rendered with FUNSTACK Router. The
        convention is configurable via custom adapters.
      </p>
    </div>
  );
}

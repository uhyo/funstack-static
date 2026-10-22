export default function About() {
  return (
    <div>
      <h1>About</h1>
      <p>
        This example demonstrates the built-in file-system routing of{" "}
        <a href="https://github.com/uhyo/funstack-static">FUNSTACK Static</a>{" "}
        configured as a multi-page application (
        <code>mode: &quot;mpa&quot;</code>
        ).
      </p>
      <p>
        Routes are derived from the file structure under <code>src/pages/</code>{" "}
        using the Next.js-like adapter and rendered with FUNSTACK Router&apos;s{" "}
        <code>&lt;RouteDisplay&gt;</code>. Each generated page is a standalone
        document: following a link loads the destination&apos;s HTML, exactly as
        a plain HTML link would.
      </p>
    </div>
  );
}

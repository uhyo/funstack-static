export default function About() {
  return (
    <div id="root">
      <h1>About</h1>
      <p>
        This is an example application built with{" "}
        <a href="https://github.com/anthropics/funstack-static">
          FUNSTACK Static
        </a>
        , demonstrating multiple entrypoints for multi-page static site
        generation with React Server Components.
      </p>
      <p>
        Each page is defined as a separate entry in <code>src/entries.tsx</code>
        , and gets its own HTML file during the build.
      </p>
    </div>
  );
}

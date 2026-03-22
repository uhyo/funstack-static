export default function Home() {
  return (
    <div>
      <h1>Home</h1>
      <p>
        Welcome to the file-system routing example! Pages in{" "}
        <code>src/pages/</code> are automatically mapped to routes using{" "}
        <code>import.meta.glob</code>.
      </p>
      <h2>How it works</h2>
      <ul>
        <li>
          <code>pages/index.tsx</code> → <code>/</code>
        </li>
        <li>
          <code>pages/about.tsx</code> → <code>/about</code>
        </li>
        <li>
          <code>pages/blog/index.tsx</code> → <code>/blog</code>
        </li>
      </ul>
      <p>
        Add a new <code>.tsx</code> file in the <code>pages/</code> directory
        and it will be automatically discovered as a new route.
      </p>
    </div>
  );
}

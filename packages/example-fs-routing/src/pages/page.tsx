export default function Home() {
  return (
    <div>
      <h1>Home</h1>
      <p>
        Welcome to the file-system routing example! Pages in{" "}
        <code>src/pages/</code> are automatically mapped to routes by{" "}
        <code>@funstack/static</code>&apos;s built-in file-system routing.
      </p>
      <h2>How it works</h2>
      <ul>
        <li>
          <code>pages/page.tsx</code> → <code>/</code>
        </li>
        <li>
          <code>pages/about/page.tsx</code> → <code>/about</code>
        </li>
        <li>
          <code>pages/blog/page.tsx</code> → <code>/blog</code>
        </li>
      </ul>
      <p>
        Add a new <code>page.tsx</code> file in a directory under{" "}
        <code>pages/</code> and it is automatically discovered as a new route.
      </p>
    </div>
  );
}

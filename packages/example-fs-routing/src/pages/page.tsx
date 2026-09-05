export default function Home() {
  return (
    <div>
      <h1>Home</h1>
      <p>
        Welcome to the file-system routing example! Pages in{" "}
        <code>src/pages/</code> are automatically mapped to routes by{" "}
        <code>@funstack/static</code>&apos;s built-in file-system routing.
      </p>
      <h2>Routes in this example</h2>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Route</th>
            <th>Demonstrates</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>pages/page.tsx</code>
            </td>
            <td>
              <a href="/">/</a>
            </td>
            <td>A page for the root directory</td>
          </tr>
          <tr>
            <td>
              <code>pages/about/page.tsx</code>
            </td>
            <td>
              <a href="/about">/about</a>
            </td>
            <td>A static route</td>
          </tr>
          <tr>
            <td>
              <code>pages/blog/layout.tsx</code>
            </td>
            <td>—</td>
            <td>
              A layout wrapping every <code>/blog/…</code> page
            </td>
          </tr>
          <tr>
            <td>
              <code>pages/blog/page.tsx</code>
            </td>
            <td>
              <a href="/blog">/blog</a>
            </td>
            <td>The blog index</td>
          </tr>
          <tr>
            <td>
              <code>pages/blog/featured/page.tsx</code>
            </td>
            <td>
              <a href="/blog/featured">/blog/featured</a>
            </td>
            <td>A static page taking precedence over a dynamic sibling</td>
          </tr>
          <tr>
            <td>
              <code>pages/blog/[slug]/page.tsx</code>
            </td>
            <td>
              <a href="/blog/hello">/blog/:slug</a>
            </td>
            <td>
              A dynamic Server Component page with{" "}
              <code>generateStaticParams</code>, live params on soft navigation,
              and the route object
            </td>
          </tr>
          <tr>
            <td>
              <code>pages/docs/[lang]/layout.tsx</code>
            </td>
            <td>—</td>
            <td>A Server Component layout under a dynamic segment</td>
          </tr>
          <tr>
            <td>
              <code>pages/docs/[lang]/page.tsx</code>
            </td>
            <td>
              <a href="/docs/en">/docs/:lang</a>
            </td>
            <td>
              A Client Component page (<code>&quot;use client&quot;</code> body
              split from <code>generateStaticParams</code>)
            </td>
          </tr>
          <tr>
            <td>
              <code>pages/docs/[lang]/[topic]/page.tsx</code>
            </td>
            <td>
              <a href="/docs/en/layouts">/docs/:lang/:topic</a>
            </td>
            <td>A page with two dynamic segments</td>
          </tr>
        </tbody>
      </table>
      <p>
        Add a new <code>page.tsx</code> file in a directory under{" "}
        <code>pages/</code> and it is automatically discovered as a new route.
      </p>
    </div>
  );
}

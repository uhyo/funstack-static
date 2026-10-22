export default function Home() {
  return (
    <div>
      <h1>Home</h1>
      <p>
        Welcome to the file-system routing example in <strong>MPA mode</strong>!
        Pages in <code>src/pages/</code> are mapped to routes by{" "}
        <code>@funstack/static</code>&apos;s built-in file-system routing, as in
        the <code>example-fs-routing</code> package. The difference is one line
        in <code>vite.config.ts</code>: <code>mode: &quot;mpa&quot;</code>.
      </p>
      <h2>What MPA mode changes</h2>
      <ul>
        <li>
          Pages are rendered with FUNSTACK Router&apos;s{" "}
          <code>&lt;RouteDisplay&gt;</code> instead of{" "}
          <code>&lt;Router&gt;</code>. It never intercepts navigations, so every
          link performs a regular full page load of the destination&apos;s own
          HTML.
        </li>
        <li>
          The build emits one HTML file and one RSC payload per page, and
          nothing else: no pre-rendered chunks are needed, because nothing is
          fetched on navigation.
        </li>
        <li>
          Client-side state does not survive navigation. Click the button in the
          navigation bar a few times, then follow a link: it starts over.
        </li>
      </ul>
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
            <td>The blog index, reading the URL in a Client Component</td>
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
              <code>generateStaticParams</code>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

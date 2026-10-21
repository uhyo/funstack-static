import "./index.css";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>FS Routing MPA E2E Fixture</title>
      </head>
      <body>
        <nav>
          <a href="/">Home</a> | <a href="/about">About</a> |{" "}
          <a href="/blog">Blog</a> | <a href="/blog/hello">Hello post</a> |{" "}
          <a href="/counter">Counter</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}

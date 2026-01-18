import type React from "react";
import "./styles/globals.css";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>FUNSTACK Static - docs</title>
        <meta
          name="description"
          content="FUNSTACK Static - A React framework without servers"
        />
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="FUNSTACK Static - docs" />
        <meta
          property="og:description"
          content="FUNSTACK Static - A React framework without servers"
        />
        <meta
          property="og:image"
          content="https://uhyo.github.io/funstack-static/FUNSTACK_Static_Hero_small.png"
        />
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="FUNSTACK Static - docs" />
        <meta
          name="twitter:description"
          content="FUNSTACK Static - A React framework without servers"
        />
        <meta
          name="twitter:image"
          content="https://uhyo.github.io/funstack-static/FUNSTACK_Static_Hero_small.png"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script>
          {`
// GitHub Pages SPA redirect hack - restore URL from query params
// See: https://github.com/rafgraph/spa-github-pages
(function (l) {
  if (l.search[1] === "p") {
    var decoded = l.search
      .slice(3)
      .split("&")
      .map(function (s) {
        return s.replace(/~and~/g, "&");
      })
      .join("?");
    window.history.replaceState(
      null,
      "",
      l.pathname.slice(0, -1) + "/" + decoded + l.hash,
    );
  }
})(window.location);
            `}
        </script>
      </head>
      <body>{children}</body>
    </html>
  );
}

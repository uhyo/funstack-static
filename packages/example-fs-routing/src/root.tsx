import type React from "react";
import "./index.css";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>FUNSTACK Static - File-System Routing</title>
      </head>
      <body>
        <nav>
          <a href="/">Home</a> | <a href="/about">About</a> |{" "}
          <a href="/blog">Blog</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}

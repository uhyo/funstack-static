import type React from "react";
import "./index.css";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/vite.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Vite + RSC</title>
      </head>
      <body>
        <nav>
          <a href="/">Home</a> | <a href="/about">About</a>
        </nav>
        <div className="app">{children}</div>
      </body>
    </html>
  );
}

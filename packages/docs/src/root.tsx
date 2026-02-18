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
          content="https://static.funstack.work/FUNSTACK_Static_Hero_small.png"
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
          content="https://static.funstack.work/FUNSTACK_Static_Hero_small.png"
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
      </head>
      <body>{children}</body>
    </html>
  );
}

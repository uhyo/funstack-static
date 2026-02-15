export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <title>Multi-Entry E2E Fixture</title>
      </head>
      <body>{children}</body>
    </html>
  );
}

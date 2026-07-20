// A Root that violates the "keep {children} alone in its parent element"
// constraint: the <header> shares <body> with the app mount point, so the
// production client mount destroys it and a console error is reported.
export default function RootDestructive({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <title>Destructive Mount Fixture</title>
      </head>
      <body>
        <header data-testid="doomed-header">Static Header</header>
        {children}
      </body>
    </html>
  );
}

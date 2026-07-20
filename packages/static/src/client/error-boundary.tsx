"use client";

import React, { startTransition } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

/**
 * Whole-page error boundary for unexpected errors during development
 *
 * With `embedded`, the fallback is rendered without the `<html>`/`<body>`
 * wrapper, for roots mounted inside an element rather than at the document.
 */
export const GlobalErrorBoundary: React.FC<
  React.PropsWithChildren<{ embedded?: boolean }>
> = (props) => {
  return (
    <ErrorBoundary
      FallbackComponent={props.embedded ? EmbeddedFallback : Fallback}
    >
      {props.children}
    </ErrorBoundary>
  );
};

const fallbackStyle: React.CSSProperties = {
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  placeContent: "center",
  placeItems: "center",
  fontSize: "24px",
  fontWeight: 400,
  lineHeight: "1.5em",
};

const FallbackContent: React.FC<FallbackProps> = ({
  error,
  resetErrorBoundary,
}) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return (
    <>
      <h1>Caught an unexpected error</h1>
      <p>See the console for details.</p>
      <pre>Error: {errorMessage}</pre>
      <button
        onClick={() => {
          startTransition(() => {
            resetErrorBoundary();
          });
        }}
      >
        Reset
      </button>
    </>
  );
};

const Fallback: React.FC<FallbackProps> = (props) => {
  return (
    <html>
      <head>
        <title>Unexpected Error</title>
      </head>
      <body style={fallbackStyle}>
        <FallbackContent {...props} />
      </body>
    </html>
  );
};

const EmbeddedFallback: React.FC<FallbackProps> = (props) => {
  return (
    <div style={fallbackStyle}>
      <FallbackContent {...props} />
    </div>
  );
};

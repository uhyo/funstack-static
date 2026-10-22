"use client";
import { useState } from "react";

// Client-side state in the shell. In an SPA this state would survive
// navigation between pages; in this MPA every link loads a new document, so
// the counter starts over on each page.
export function VisitCounter() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setCount((c) => c + 1)}
      title="Client-side state; resets on every navigation in an MPA"
    >
      Clicked {count} times
    </button>
  );
}

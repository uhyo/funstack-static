"use client";
import { useState } from "react";

// Client-side state in the shell. It survives soft client-side navigation
// but is reset by a full page load, so it tells the two apart.
export function NavCounter() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      data-testid="nav-counter"
      onClick={() => setCount((c) => c + 1)}
    >
      {count}
    </button>
  );
}

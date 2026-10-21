"use client";
import { useState } from "react";

// A Client Component page: rendered to HTML with its initial state, but not
// hydrated — clicking does nothing, as no JavaScript ships.
export default function CounterPage() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p data-testid="page-id">counter</p>
      <button data-testid="counter" onClick={() => setCount((c) => c + 1)}>
        Count: {count}
      </button>
    </div>
  );
}

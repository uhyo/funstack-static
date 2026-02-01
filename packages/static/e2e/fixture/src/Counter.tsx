"use client";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    __REACT_HYDRATED_TIMESTAMP__?: number;
  }
}

export function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Record when React hydration completes (useEffect runs after hydration)
    if (!window.__REACT_HYDRATED_TIMESTAMP__) {
      window.__REACT_HYDRATED_TIMESTAMP__ = Date.now();
    }
  }, []);

  return (
    <button data-testid="counter" onClick={() => setCount((c) => c + 1)}>
      Count: {count}
    </button>
  );
}

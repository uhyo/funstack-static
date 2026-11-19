"use client";
import { useEffect, useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return (
    <button
      data-testid="counter"
      data-hydrated={hydrated}
      onClick={() => setCount((c) => c + 1)}
    >
      Count: {count}
    </button>
  );
}

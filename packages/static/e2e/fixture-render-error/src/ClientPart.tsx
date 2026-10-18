"use client";

export function ClientPart({ children }: { children?: unknown }) {
  return <p>{typeof children === "function" ? children() : "client part"}</p>;
}

export function ThrowOnServer() {
  if (typeof window === "undefined") {
    throw new Error("ThrowOnServer: error thrown during SSR");
  }
  return <p>client only</p>;
}

import { Suspense } from "react";
import { ClientPart } from "../ClientPart";

export default function App() {
  return (
    <main>
      {/* With SSR, the boundary lets prerendering recover from the error by
          client-rendering this part, so only onError reports it. */}
      <Suspense fallback={<p>loading</p>}>
        {/* Functions cannot be passed to Client Components (#194) */}
        <ClientPart>{() => "x"}</ClientPart>
      </Suspense>
    </main>
  );
}

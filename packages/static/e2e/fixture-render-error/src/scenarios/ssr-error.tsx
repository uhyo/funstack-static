import { Suspense } from "react";
import { ThrowOnServer } from "../ClientPart";

export default function App() {
  return (
    <main>
      <Suspense fallback={<p>loading</p>}>
        <ThrowOnServer />
      </Suspense>
    </main>
  );
}

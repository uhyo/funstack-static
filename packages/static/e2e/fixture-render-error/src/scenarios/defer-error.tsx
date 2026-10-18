import { Suspense } from "react";
import { defer } from "@funstack/static/server";

function Throws(): React.ReactNode {
  throw new Error("Throws: error thrown in a deferred component");
}

export default function App() {
  return (
    <main>
      <Suspense fallback={<p>loading</p>}>
        {defer(<Throws />, { name: "Throws" })}
      </Suspense>
    </main>
  );
}

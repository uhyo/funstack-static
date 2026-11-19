import { defer } from "@funstack/static/entries/rsc";
import { Counter } from "./Counter";
import DeferredSection from "./DeferredSection";

export default function App() {
  return (
    <main>
      <h1>No Router App</h1>
      <Counter />
      {defer(<DeferredSection />, { name: "DeferredSection" })}
    </main>
  );
}

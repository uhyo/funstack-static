import { defer } from "@funstack/static/server";
import { ClientPart } from "../ClientPart";

function Deferred() {
  return <p>deferred</p>;
}

export default function App() {
  return (
    <main>
      <ClientPart />
      {defer(<Deferred />, { name: "Deferred" })}
    </main>
  );
}

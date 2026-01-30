import { Counter } from "./Counter";

export default function App() {
  return (
    <main>
      <h1>E2E Test App</h1>
      <p data-testid="server-rendered">Server rendered content</p>
      <Counter />
    </main>
  );
}

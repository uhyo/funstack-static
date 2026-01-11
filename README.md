## FUNSTACK Static

A maximally minimal React framework.

> [!WARNING]
> This is work in progress.

**Features:**

- :x: **No server runs** - perfect for CSR (Client Side Rendering) app and static deployment.
- :white_check_mark: **RSC support** - React Server Components are supported even without a server which helps reduce bundle size and improve performance.
- :white_check_mark: **Vite-based** - so minimal that this framework is served as a Vite plugin (based on [@vitejs/plugin-rsc](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc#readme))

### Usage

See [the example project](./packages/example/vite.config.ts) for complete usage.

```ts
// vite.config.ts
import funstackStatic from "@funstack/static";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    funstackStatic({
      root: "./src/root.tsx",
      app: "./src/App.tsx",
    }),
    react(),
  ],
});
```

## License

MIT

## FUNSTACK Static

![Hero Image](./docs/FUNSTACK_Static_Hero_small.png)

A maximally minimal React framework.

> [!WARNING]
> This is work in progress.

**Features:**

- :x: **No server runs** - perfect for CSR (Client Side Rendering) app and static deployment.
- :x: **No RCE vulnerabilities** - No server, no risk.
- :white_check_mark: **RSC support** - React Server Components are supported even without a server which helps reduce bundle size and improve performance.
- :white_check_mark: **Server Component Code Splitting** - a brand new `defer()` API allows you to split RSC Payload into multiple chunks and load them on demand.
- :white_check_mark: **Vite-based** - so minimal that this framework is served as a Vite plugin (based on [@vitejs/plugin-rsc](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc#readme))

### Usage

**[Documentation](https://uhyo.github.io/funstack-static/)**

See [the example project](./packages/example/vite.config.ts) and [the docs project](./packages/docs/vite.config.ts) for complete usage.

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

### See the framework in action

```sh
pnpm install
pnpm build
# Start a development server
pnpm --filter docs dev
# Start a preview of the production build
pnpm --filter docs preview
```

### :sailboat: Project Status

This project is in early development, but we believe it is already usable. It has all the features needed for building CSR apps with RSC.

We are not aware of any production deployments yet. Be the first!

## License

MIT

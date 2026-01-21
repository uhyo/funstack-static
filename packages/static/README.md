# @funstack/static

A maximally minimal React framework. Vite plugin for static sites with RSC support.

> [!WARNING]
> This is work in progress.

## Features

- :x: **No server runs** - perfect for CSR (Client Side Rendering) app and static deployment.
- :x: **No RCE vulnerabilities** - No server, no risk.
- :white_check_mark: **RSC support** - React Server Components are supported even without a server which helps reduce bundle size and improve performance.
- :white_check_mark: **Server Component Code Splitting** - a brand new `defer()` API allows you to split RSC Payload into multiple chunks and load them on demand.
- :white_check_mark: **Vite-based** - so minimal that this framework is served as a Vite plugin (based on [@vitejs/plugin-rsc](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc#readme))

## Installation

```sh
npm install @funstack/static
```

## Quick Start

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

## Documentation

For detailed API documentation and guides, visit the **[Documentation](https://uhyo.github.io/funstack-static/)**.

## License

MIT

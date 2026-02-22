# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FUNSTACK Static (`@funstack/static`) is a Vite plugin that provides a React framework with React Server Components (RSC) support — without a runtime server. It generates static HTML + RSC payloads for client-side rendering, suitable for static hosting.

## Repository Structure

pnpm monorepo with Turbo for build orchestration.

- `packages/static/` — Core framework package (`@funstack/static`)
- `packages/docs/` — Documentation site (built with the framework itself)
- `packages/example/` — Example application
- `packages/static/e2e/` — E2E test fixtures and tests

## Common Commands

All commands run from the repository root unless noted otherwise.

```sh
pnpm install                # Install dependencies
pnpm build                  # Build all packages (via Turbo)
pnpm typecheck              # Type-check all packages
pnpm lint                   # Lint with oxlint
pnpm format                 # Format with Prettier
pnpm format:check           # Check formatting
```

### Testing

```sh
pnpm test                   # Unit tests in watch mode (vitest)
pnpm test:run               # Unit tests single run
pnpm test:e2e               # E2E tests against production build (Playwright)
pnpm test:e2e:dev           # E2E tests against dev server (Playwright)
```

**Important:** E2E fixtures import from `dist/` (via package exports), not `src/`. You must run `pnpm build` after changing source code before running e2e tests. Turbo handles this automatically when running from the root.

### Dev Server

```sh
pnpm --filter docs dev       # Start docs dev server
pnpm --filter docs preview   # Preview docs production build
```

## Architecture

### Plugin Modes

The Vite plugin supports two configuration modes:

- **Single-entry:** `{ root: "./src/root.tsx", app: "./src/App.tsx" }` — one HTML page
- **Multi-entry:** `{ entries: "./src/entries.tsx" }` — multiple pages via `EntryDefinition[]`

Options: `ssr` (default: false), `publicOutDir` (default: "dist/public"), `clientInit` (client-side init module path).

### Source Organization (`packages/static/src/`)

- `plugin/` — Vite plugin setup (`index.ts`), dev/preview server middleware (`server.ts`)
- `rsc/` — RSC entry point (`entry.tsx`), deferred components (`defer.tsx`), entry resolution
- `client/` — Client hydration entry (`entry.tsx`), error boundary
- `ssr/` — SSR rendering with `react-dom/static.prerender()`
- `build/` — Build orchestration, content hashing, dependency graph, entry path validation
- `entries/` — Export entry points for different Vite environments (rsc, client, ssr, server)
- `rsc-client/` — Client-side RSC wrapper
- `util/` — URL path mapping, base path handling, stream utilities

### RSC + SSR Flow

1. **Build time:** RSC renders server components → RSC payloads written as static files
2. **SSR (optional):** Root and App are server-rendered to HTML
3. **Client:** Hydrates (if SSR) or renders from RSC payloads; `defer()` enables lazy-loaded RSC chunks

## Conventions

- TypeScript strict mode with `verbatimModuleSyntax` (explicit type imports required)
- Unit tests colocated with source (`*.test.ts`)
- E2E tests separated: `e2e/tests/` (build/preview) and `e2e/tests-dev/` (dev server)

### Commit Messages

- Use conventional commits format: `type(scope): description`

To distinguish what should be included in the changelog, fixes in the docs or example packages should be marked with `docs` or `example` scope, respectively. For example:

- `fix(docs): correct typo in README`
- `fix(example): update dependencies in example package`

Changes to the main static package can be left without a scope or marked with `static`:

- `feat: add new API for deferred components`
- `feat(static): add new API for deferred components`

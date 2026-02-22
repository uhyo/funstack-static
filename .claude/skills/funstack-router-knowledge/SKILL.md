---
name: funstack-router-knowledge
description: Use this skill when you need information about `@funstack/router` (the React router your app uses). What it is, API references, best practices, etc.
metadata:
  internal: true
---

# FUNSTACK Router Knowledge

**FUNSTACK Router** (`@funstack/router`) is a modern React router built on the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) (not the History API). It uses the [URLPattern API](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) for path matching.

## Entrypoints

- `@funstack/router` — Main entrypoint. Provides `Router`, `Outlet`, hooks (`useNavigate`, `useRouteParams`, etc.), and route definition utilities (`route()`, `routeState()`).
- `@funstack/router/server` — Entrypoint for Server context when you are using React Server Components. Provides `route()` and `routeState()` utilities for defining routes in server modules.

## FUNSTACK Router Docs

More detailed documentation (including API references and best practices) can be found at:

```
node_modules/@funstack/router/dist/docs/index.md
```

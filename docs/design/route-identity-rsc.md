# Design: Two-Phase Route Definition for RSC

## Problem Statement

When using `@funstack/router` with React Server Components (RSC), there is a
fundamental tension between **type-safe routing** and the **RSC module boundary**.

### The Circular Dependency

```
      Server Module (App.tsx)              Client Module ("use client")
  ┌──────────────────────────┐         ┌──────────────────────────┐
  │                          │         │                          │
  │  route({                 │         │  useRouteParams(???)     │
  │    id: "user",           │         │  // needs route object   │
  │    path: "/users/:userId"│         │  // for type safety      │
  │    component: <Profile/> │  ──✗──► │                          │
  │    loader: fetchUser     │         │  useRouteData(???)       │
  │  })                      │         │  // needs route object   │
  │                          │         │  // for typed data       │
  │  (can reference server   │         │                          │
  │   components ✓)          │         │                          │
  └──────────────────────────┘         └──────────────────────────┘
          Client cannot import from server module
```

**If routes are in a server module** — they can reference server components, but
client components cannot import them (RSC boundary prevents it).

**If routes are in a shared module** — client components can import them, but they
cannot reference server components (server component imports make a module
server-only).

**Result:** There is no single location where route objects can both reference
server components AND be imported by client components for type-safe hooks.

---

## Key Insight

The only part of a route definition that is inherently server-specific is the
**component reference** (because the component may be a server component). Every
other aspect of a route — path, id, loader, action, state — is client-safe:

```
  ┌──────────────────────────────────────────────────────────┐
  │                    route() definition                     │
  │                                                          │
  │  ┌──────────────────────────────────┐  ┌──────────────┐  │
  │  │  id, path, loader, action, state │  │  component   │  │
  │  │  (client-safe — runs in browser) │  │  (may be a   │  │
  │  │                                  │  │   server     │  │
  │  │  ✓ Importable by "use client"    │  │   component) │  │
  │  └──────────────────────────────────┘  └──────────────┘  │
  │         everything else                  the only         │
  │                                          server part      │
  └──────────────────────────────────────────────────────────┘
```

**Loaders and actions run client-side** (they execute in the browser during
navigation), so they can live in shared modules. The type information that client
components need — `Params` from path, `Data` from loader, `State` from
`routeState` — is all carried by the non-component parts.

This means we can split a route definition at exactly one point: the component.

---

## Proposed Solution: Two-Phase Route Definition

### Overview

```
  Phase 1: route()                      Phase 2: bindRoute()
  (shared module — colocated            (server module — assembles
   with page components)                 route tree for <Router/>)

  ┌─────────────────────────┐          ┌──────────────────────────┐
  │  route({                │          │                          │
  │    id: "user",          │─────────►│  bindRoute(userRoute, {  │
  │    path: "/:userId",    │          │    component: <Profile/> │
  │    loader: fetchUser,   │          │  })                      │
  │  })                     │          │                          │
  └────────────┬────────────┘          └──────────────────────────┘
               │
               │  import (shared → client ✓)
               ▼
  ┌──────────────────────────┐
  │  "use client"            │
  │                          │
  │  useRouteParams(userRoute│  ← Params from path ✓
  │  useRouteData(userRoute) │  ← Data from loader ✓
  │  useRouteState(userRoute)│  ← State from routeState ✓
  └──────────────────────────┘
```

### Phase 1 — Route Definition Without Component (Shared Module)

The existing `route()` function, when called **without a `component`**, produces
a partial route object. This object carries all type information (params, data,
state) and is safe to import from client modules.

The recommended pattern is to **colocate** each route definition with the page
components that use it:

```
src/
  pages/
    user/
      route.ts            ← Phase 1: route with loader (shared)
      UserProfile.tsx     ← Server component
      UserActions.tsx     ← "use client" — imports ./route
    settings/
      route.ts            ← Phase 1: route with state (shared)
      Settings.tsx        ← Server component
      SettingsPanel.tsx   ← "use client" — imports ./route
  App.tsx                 ← Phase 2: bindRoute() for all pages
```

```typescript
// src/pages/user/route.ts — shared module
import { route } from "@funstack/router";
import type { User } from "../../types";

export const userRoute = route({
  id: "user",
  path: "/:userId",
  loader: async ({ params }) => {
    const res = await fetch(`/api/users/${params.userId}`);
    return res.json() as Promise<User>;
  },
});
// All types inferred:
//   Params = { userId: string }  — from path
//   Data   = User                — from loader
```

```tsx
// src/pages/user/UserActions.tsx — "use client"
import { userRoute } from "./route";
import { useRouteParams, useRouteData } from "@funstack/router";

export function UserActions() {
  const { userId } = useRouteParams(userRoute);  // { userId: string } ✓
  const user = useRouteData(userRoute);           // User ✓
  // ...
}
```

### Phase 2 — Binding Components (Server Module)

A **new function `bindRoute()`** takes a Phase 1 route and adds the component
(and optionally children) to produce a full `RouteDefinition` for `<Router />`.

This function lives in `@funstack/router/server` — the server-only entrypoint.

```tsx
// src/App.tsx — server component
import { bindRoute } from "@funstack/router/server";
import { Outlet } from "@funstack/router";
import { homeRoute } from "./pages/home/route";
import { Home } from "./pages/home/Home";
import { userRoute } from "./pages/user/route";
import { UserProfile } from "./pages/user/UserProfile";
import { settingsRoute } from "./pages/settings/route";
import { Settings } from "./pages/settings/Settings";
import { Router } from "./Router";

const routes = [
  bindRoute(homeRoute, {
    component: <Home />,
  }),
  bindRoute(userRoute, {
    component: <UserProfile />,
  }),
  bindRoute(settingsRoute, {
    component: <Settings />,
    children: [
      // nested routes...
    ],
  }),
];

export default function App({ ssrPath }: { ssrPath: string }) {
  return <Router routes={routes} fallback="static" ssr={{ path: ssrPath }} />;
}
```

---

## API Design

### Phase 1: `route()` — Route Without Component

This is the existing `route()` function. When called without a `component`
property, it returns a **partial route** — an object that carries all type
information but cannot be rendered by the Router on its own.

```typescript
// Existing call with component → full RouteDefinition (unchanged)
route({
  id: "user",
  path: "/:userId",
  component: <UserProfile />,
  loader: fetchUser,
});

// NEW: call without component → PartialRouteDefinition
route({
  id: "user",
  path: "/:userId",
  loader: fetchUser,
});
```

The return type when `component` is absent:

```typescript
type PartialRouteDefinition<TId, TParams, TState, TData> = {
  readonly id: TId;
  readonly path: string;
  readonly [partialRouteBrand]: {
    id: TId;
    params: TParams;
    state: TState;
    data: TData;
  };
  // loader, action, etc. are stored internally
};
```

This type carries the same type parameters as `TypefulOpaqueRouteDefinition`
and is accepted by all hooks.

**`routeState()` works as-is:**

```typescript
// src/pages/settings/route.ts
import { routeState } from "@funstack/router";

export const settingsRoute = routeState<{ tab: string }>()({
  id: "settings",
  path: "/settings",
});
// Params = {}, State = { tab: string }
```

**Entrypoint:** `route()` and `routeState()` are available from both
`@funstack/router` and `@funstack/router/server` (as today).

### Phase 2: `bindRoute()` — Bind Component to Route

A new function exported from `@funstack/router/server`:

```typescript
function bindRoute<TId, TParams, TState, TData>(
  partialRoute: PartialRouteDefinition<TId, TParams, TState, TData>,
  binding: {
    component: ReactNode | ComponentType<RouteComponentPropsOf<...>>;
    children?: RouteDefinition[];
    exact?: boolean;
    requireChildren?: boolean;
  },
): TypefulOpaqueRouteDefinition<TId, TParams, TState, TData>;
```

**Parameters:**
- `partialRoute` — A Phase 1 route object (output of `route()` without
  component)
- `binding.component` — The React component to render (may be a server
  component)
- `binding.children` — Child routes for nested routing (optional)

**Returns:** A full `TypefulOpaqueRouteDefinition` — the same type that the
existing `route()` with component returns. Fully compatible with `<Router />`.

**Entrypoint:** `@funstack/router/server` only, since the component may
reference server components.

**Routes without `id`:** `bindRoute` also accepts `OpaqueRouteDefinition`
(routes created without `id`), returning an `OpaqueRouteDefinition`. This
supports layout routes like `<Outlet />` wrappers that don't need typed hooks:

```typescript
const usersLayout = route({ path: "/users" });
bindRoute(usersLayout, { component: <Outlet />, children: [...] });
```

### Hook Compatibility

All hooks accept both `PartialRouteDefinition` and
`TypefulOpaqueRouteDefinition`:

```typescript
function useRouteParams<T>(route: T): ExtractRouteParams<T>;
function useRouteState<T>(route: T): ExtractRouteState<T> | undefined;
function useRouteData<T>(route: T): ExtractRouteData<T>;
```

At runtime, both types carry an `id` property. The hooks call
`useRouteContext(route.id)` to look up the matching context — the same
mechanism as today.

---

## Collocation Pattern

The recommended project structure colocates each route definition with its page:

```
src/pages/user/
  route.ts          ← Phase 1 (shared): id, path, loader
  UserProfile.tsx   ← Server component (the page itself)
  UserActions.tsx   ← "use client" component (imports route.ts for hooks)
```

**Why collocation works well:**

1. **Locality** — The route definition is next to the components that use it.
   `import { userRoute } from "./route"` is a short, obvious import.

2. **Encapsulation** — Each page "owns" its route. Adding a new page means
   adding a folder with route + components, then one line in `App.tsx`.

3. **Type safety is local** — The loader return type and path params are defined
   once in `route.ts` and consumed by sibling client components. No need to
   maintain a separate type declaration.

4. **Server components stay in server modules** — `UserProfile.tsx` imports
   server-only code freely. It's only referenced from `App.tsx` (also server).

---

## Nested Routes

Partial routes use **relative path segments**, matching the current router
behavior:

```typescript
// src/pages/users/route.ts
export const usersRoute = route({ id: "users", path: "/users" });

// src/pages/users/profile/route.ts
export const userProfileRoute = route({
  id: "userProfile",
  path: "/:userId",        // relative to parent
  loader: fetchUser,
});

// src/pages/users/settings/route.ts
export const userSettingsRoute = route({
  id: "userSettings",
  path: "/:userId/settings",  // relative to parent
});
```

```typescript
// src/App.tsx
const routes = [
  bindRoute(usersRoute, {
    component: <Outlet />,
    children: [
      bindRoute(userProfileRoute, {
        component: <UserProfile />,
      }),
      bindRoute(userSettingsRoute, {
        component: <UserSettings />,
      }),
    ],
  }),
];
```

This requires no changes to the router's path matching — `bindRoute` produces
standard `RouteDefinition` objects with relative segments, identical to what
`route()` with `component` produces today.

### Future Extension: `fullPath`

A `fullPath` property on `PartialRouteDefinition` could be added in the future
for use cases that require the complete URL pattern (e.g., standalone URL
construction outside of Router context). This is out of scope for the initial
implementation.

---

## TypeScript Overload Design

### Distinguishing Partial vs. Full Routes

The `route()` function currently has multiple overloads. Adding the "without
component" behavior requires TypeScript to distinguish between:

1. `route({ id, path, loader })` → `PartialRouteDefinition` (new)
2. `route({ id, path, component, loader })` → `TypefulOpaqueRouteDefinition`
   (existing)
3. `route({ path, children })` → `OpaqueRouteDefinition` (existing layout route)

**Disambiguation rule:** The presence or absence of `component` is the
discriminant. When `component` is absent AND `id` is present, the return type
is `PartialRouteDefinition`. The overloads are ordered so that this new case
is checked first:

```typescript
// NEW overload (checked first): id + no component → PartialRouteDefinition
function route<TId extends string, TPath extends string, TData>(
  definition: {
    id: TId;
    path: TPath;
    loader?: (args: LoaderArgs<PathParams<TPath>>) => TData;
    action?: ...;
    // component intentionally absent
  }
): PartialRouteDefinition<TId, PathParams<TPath>, undefined, TData>;

// Existing overloads (unchanged): with component → full RouteDefinition
function route<TId extends string, TPath extends string, TData>(
  definition: {
    id?: TId;
    path?: TPath;
    component: ReactNode | ComponentType;
    loader?: ...;
    children?: RouteDefinition[];
  }
): TypefulOpaqueRouteDefinition<...>;

// Existing: no id, no component → OpaqueRouteDefinition (layout)
function route(definition: {
  path?: string;
  children?: RouteDefinition[];
}): OpaqueRouteDefinition;
```

### `component: undefined`

If someone explicitly passes `component: undefined`, it matches the "no
component" overload and returns `PartialRouteDefinition`. This is correct
behavior — the caller did not provide a component, so the route is partial.

### `routeState()` Compatibility

The `routeState<TState>()` function returns a curried function with the same
overload structure as `route()`. When called without `component`:

```typescript
export const settingsRoute = routeState<{ tab: string }>()({
  id: "settings",
  path: "/settings",
});
// → PartialRouteDefinition<"settings", {}, { tab: string }, undefined>
```

The same disambiguation rule applies — `component` absent + `id` present →
`PartialRouteDefinition` with the `TState` type parameter populated.

### `bindRoute` Overloads

`bindRoute` has two overloads based on whether the input carries type
information:

```typescript
// Typed input (has id) → typed output
function bindRoute<TId, TParams, TState, TData>(
  partialRoute: PartialRouteDefinition<TId, TParams, TState, TData>,
  binding: {
    component: ReactNode | ComponentType;
    children?: RouteDefinition[];
    exact?: boolean;
    requireChildren?: boolean;
  },
): TypefulOpaqueRouteDefinition<TId, TParams, TState, TData>;

// Untyped input (no id) → untyped output
function bindRoute(
  partialRoute: OpaqueRouteDefinition,
  binding: {
    component: ReactNode | ComponentType;
    children?: RouteDefinition[];
    exact?: boolean;
    requireChildren?: boolean;
  },
): OpaqueRouteDefinition;
```

### Unified Type Extraction

A set of type utilities that work with both partial and full route definitions:

```typescript
type ExtractRouteParams<T> =
  T extends PartialRouteDefinition<any, infer P, any, any> ? P :
  T extends TypefulOpaqueRouteDefinition<any, infer P, any, any> ? P :
  never;

type ExtractRouteState<T> =
  T extends PartialRouteDefinition<any, any, infer S, any> ? S :
  T extends TypefulOpaqueRouteDefinition<any, any, infer S, any> ? S :
  never;

type ExtractRouteData<T> =
  T extends PartialRouteDefinition<any, any, any, infer D> ? D :
  T extends TypefulOpaqueRouteDefinition<any, any, any, infer D> ? D :
  never;
```

---

## Backwards Compatibility

The existing `route()` API is **unchanged**. The two-phase pattern is additive:

```typescript
// Old pattern — still works, no changes needed
route({
  id: "user",
  path: "/:userId",
  component: <UserProfile />,
  loader: fetchUser,
})

// New pattern — same route(), just without component
const userRoute = route({
  id: "user",
  path: "/:userId",
  loader: fetchUser,
});
// + bindRoute in server module
bindRoute(userRoute, { component: <UserProfile /> })
```

Users can adopt the new pattern incrementally, one route at a time. Routes using
the old single-phase pattern and the new two-phase pattern can coexist in the
same `routes` array.

---

## Migration Path

### Step 1: Extract route definitions from App.tsx

Move the non-component parts of each route to a colocated `route.ts`:

```typescript
// Before (App.tsx — everything in one server module)
export const userRoute = route({
  id: "user",
  path: "/:userId",
  component: <UserProfile />,
  loader: fetchUser,
});

// After:
// pages/user/route.ts (shared)
export const userRoute = route({
  id: "user",
  path: "/:userId",
  loader: fetchUser,
});

// App.tsx (server)
import { userRoute } from "./pages/user/route";
bindRoute(userRoute, { component: <UserProfile /> });
```

### Step 2: Use route objects in client components

```tsx
// pages/user/UserActions.tsx — "use client"
import { userRoute } from "./route";
import { useRouteParams, useRouteData } from "@funstack/router";

function UserActions() {
  const { userId } = useRouteParams(userRoute);  // ✓ type-safe
  const user = useRouteData(userRoute);           // ✓ type-safe
}
```

### Step 3: Simplify entries.tsx (for static generation)

```typescript
import { userRoute } from "./pages/user/route";
import { aboutRoute } from "./pages/about/route";

const staticRoutes = [userRoute, aboutRoute];

export default function getEntries(): EntryDefinition[] {
  return staticRoutes.map((r) => ({
    path: pathToEntryPath(r.path),
    root: () => import("./root"),
    app: <App ssrPath={r.path} />,
  }));
}
```

---

## Alternative Approaches Considered

### A. Global Type Registry (Module Augmentation)

```typescript
declare module "@funstack/router" {
  interface RouteRegistry {
    user: { path: "/users/:userId"; params: { userId: string } };
  }
}
const { userId } = useRouteParams("user"); // type-safe via registry
```

**Verdict:** Loses IDE navigation (go-to-definition), requires manual type
declarations (no inference from path/loader), and module augmentation is an
unfamiliar pattern. Rejected.

### B. Compile-Time Transform (Vite Plugin)

Strip `component` from route objects in client bundle automatically.

**Verdict:** Most seamless DX but high implementation complexity, implicit
behavior, and TypeScript type mismatch between server/client views.
Could be a future optimization. Rejected for now.

### C. `import type` + Runtime-Free Hooks

```typescript
import type { userRoute } from "../server/routes";
const params = useRouteParams<typeof userRoute>(); // no runtime arg
```

**Verdict:** Breaks the runtime hook contract. Can't distinguish between nested
routes without a runtime identifier. Rejected.

### D. Explicit Type Declarations on Route Identity

```typescript
const userRoute = routeId("user", "/users/:userId")
  .withData<User>()
  .withState<{ tab: string }>();
```

**Verdict:** Unnecessary once we recognize that loaders are client-side. The
loader's return type and `routeState` already carry all needed type information
naturally. Superseded by the simpler approach.

---

## Summary

The two-phase route definition solves the RSC routing dilemma by splitting at the
only server-specific boundary — the component reference:

| | Phase 1: `route()` | Phase 2: `bindRoute()` |
|---|---|---|
| **Module** | Shared (colocated with page) | Server (`App.tsx`) |
| **Contains** | id, path, loader, action, state | component, children |
| **Importable by** | Server + Client | Server only |
| **Type info** | Params, Data, State (all inferred) | Inherited from Phase 1 |

All type information flows naturally — params from path pattern, data from loader
return type, state from `routeState<T>()`. No explicit type annotations needed.
The pattern is backwards-compatible, incrementally adoptable, and encourages
a clean colocated project structure.

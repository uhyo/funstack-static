import { createFsRoutesEntries } from "@funstack/static/fs-routes";
import Root from "./root";

// Discover all page/layout files under `pages/` at build time.
const modules = import.meta.glob<{ default: React.ComponentType }>(
  "./pages/**/*.{tsx,jsx}",
  { eager: true },
);

// Map the files to routes using the built-in Next.js-like adapter and render
// them with FUNSTACK Router. Pass a custom `adapter` to use a different
// convention.
export default createFsRoutesEntries({ modules, root: Root });

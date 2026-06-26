import { createFsRoutesEntries } from "@funstack/static/fs-routes";
import Root from "./root";

const modules = import.meta.glob<{ default: React.ComponentType }>(
  "./pages/**/*.{tsx,jsx}",
  { eager: true },
);

export default createFsRoutesEntries({ modules, root: Root });

import type { EntryDefinition } from "@funstack/static/entries";

export default function getEntries(): EntryDefinition[] {
  return [
    {
      path: "index.html",
      root: () => import("./root"),
      app: () => import("./pages/Home"),
    },
    {
      path: "about.html",
      root: () => import("./root"),
      app: () => import("./pages/About"),
    },
  ];
}

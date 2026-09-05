import { languages } from "../content";

// `generateStaticParams()` runs on the server at build time, so a page module
// that exports it cannot be marked "use client". The component body lives in
// `_page.tsx` (a Client Component) and is re-exported from here.
export function generateStaticParams() {
  return languages.map((lang) => ({ lang }));
}

export { default } from "./_page";

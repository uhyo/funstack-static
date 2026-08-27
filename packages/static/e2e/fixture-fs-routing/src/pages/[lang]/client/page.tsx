// generateStaticParams runs at build time, so it lives in this Server
// Component module while the page body is a Client Component.
export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "ja" }];
}
export { default } from "./_page";

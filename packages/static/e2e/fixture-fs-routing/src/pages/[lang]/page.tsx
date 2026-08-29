import type { FsRouteComponentProps } from "@funstack/static/fs-routes";
import { LiveLang } from "./live-lang";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "ja" }];
}

// A Server Component page: rendered at build time with the concrete params,
// and given its route object to hand to Client Components for live params.
export default function LangPage({
  params,
  route,
}: FsRouteComponentProps<{ lang: string }>) {
  return (
    <div>
      <p data-testid="page-id">lang</p>
      <p data-testid="lang-page-lang">{params.lang}</p>
      <LiveLang route={route} />
      <a href="/en" data-testid="link-en">
        English
      </a>{" "}
      <a href="/ja" data-testid="link-ja">
        Japanese
      </a>{" "}
      <a href="/en/client" data-testid="link-en-client">
        English client page
      </a>{" "}
      <a href="/en/info" data-testid="link-en-info">
        English info
      </a>
    </div>
  );
}

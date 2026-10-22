import type { FsRouteComponentProps } from "@funstack/static/fs-routes";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "ja" }];
}

export default function LangPage({
  params,
}: FsRouteComponentProps<{ lang: string }>) {
  return (
    <div>
      <p data-testid="page-id">lang</p>
      <p data-testid="lang-page-lang">{params.lang}</p>
      <a href="/en" data-testid="link-en">
        English
      </a>{" "}
      <a href="/ja" data-testid="link-ja">
        Japanese
      </a>{" "}
      <a href="/en/client" data-testid="link-en-client">
        English client page
      </a>
    </div>
  );
}

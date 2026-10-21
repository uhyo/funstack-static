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
    </div>
  );
}

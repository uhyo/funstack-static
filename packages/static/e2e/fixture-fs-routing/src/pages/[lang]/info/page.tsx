import type { FsRouteComponentProps } from "@funstack/static/fs-routes";

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "ja" }];
}

// A Server Component page under a Server Component layout, both below a
// dynamic segment.
export default function InfoPage({
  params,
}: FsRouteComponentProps<{ lang: string }>) {
  return (
    <div>
      <p data-testid="page-id">info</p>
      <p data-testid="info-page-lang">{params.lang}</p>
      <a href="/en/info" data-testid="link-en-info">
        English info
      </a>{" "}
      <a href="/ja/info" data-testid="link-ja-info">
        Japanese info
      </a>{" "}
      <a href="/en" data-testid="link-en-home">
        English home
      </a>
    </div>
  );
}

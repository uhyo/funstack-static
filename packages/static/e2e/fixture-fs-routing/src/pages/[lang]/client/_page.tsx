"use client";

// A Client Component page: the router renders it with the live params of the
// current match, so it stays correct across soft client-side navigation.
export default function ClientLangPage({
  params,
}: {
  params: { lang: string };
}) {
  return (
    <div>
      <p data-testid="page-id">lang-client</p>
      <p data-testid="client-page-lang">{params.lang}</p>
      <a href="/en/client" data-testid="link-en-client">
        English client page
      </a>{" "}
      <a href="/ja/client" data-testid="link-ja-client">
        Japanese client page
      </a>
    </div>
  );
}

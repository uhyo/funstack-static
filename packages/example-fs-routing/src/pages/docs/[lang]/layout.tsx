import { Outlet } from "@funstack/router";
import type { FsRouteComponentProps } from "@funstack/static/fs-routes";
import { languageNames, languages, isLanguage } from "../content";

// A Server Component layout under a dynamic segment. It is pre-rendered once
// per `lang` and, like a Server Component page, its output is swapped on soft
// navigation so `params.lang` always matches the URL shown.
//
// Because the layout is rendered per params combination, it only receives
// the params of the segments at or above it: `{ lang }`, never the `{ topic }`
// of the `[topic]` page below. (A `"use client"` layout would instead receive
// the router's live params of the full current match.)
export default function DocsLayout({
  params,
}: FsRouteComponentProps<{ lang: string }>) {
  const lang = params.lang;
  return (
    <section>
      <p>
        <small>
          <code>pages/docs/[lang]/layout.tsx</code> — build-time{" "}
          <code>params</code> of this layout:{" "}
          <code>{JSON.stringify(params)}</code>
        </small>
      </p>
      <p>
        Language:{" "}
        {languages.map((candidate, index) => (
          <span key={candidate}>
            {index > 0 ? " | " : null}
            {candidate === lang ? (
              <strong>{languageNames[candidate]}</strong>
            ) : (
              <a href={`/docs/${candidate}`}>{languageNames[candidate]}</a>
            )}
          </span>
        ))}
      </p>
      {isLanguage(lang) ? <Outlet /> : <p>Unknown language: {lang}</p>}
    </section>
  );
}

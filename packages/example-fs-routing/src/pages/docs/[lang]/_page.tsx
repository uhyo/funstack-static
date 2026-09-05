"use client";
import { useRouteParams } from "@funstack/router";
import type { FsRouteComponentProps } from "@funstack/static/fs-routes";
import { isLanguage, languageNames, topics } from "../content";

// A Client Component page under a dynamic segment. FUNSTACK Router renders it
// in the browser with the live `params` of the current match and its route
// object, so both stay correct across soft client-side navigation without any
// pre-rendered chunk being fetched.
export default function DocsIndex({
  params,
  route,
}: FsRouteComponentProps<{ lang: string }>) {
  const liveParams = useRouteParams(route);
  if (!isLanguage(params.lang)) {
    return null;
  }
  const lang = params.lang;
  return (
    <div>
      <h1>Docs ({languageNames[lang]})</h1>
      <p>
        This page is a Client Component (
        <code>pages/docs/[lang]/_page.tsx</code>, re-exported from{" "}
        <code>page.tsx</code>). Its <code>params.lang</code> is{" "}
        <strong>{params.lang}</strong> and{" "}
        <code>useRouteParams(route).lang</code> is{" "}
        <strong>{liveParams.lang}</strong>.
      </p>
      <ul>
        {topics.map((topic) => (
          <li key={topic.slug}>
            <a href={`/docs/${lang}/${topic.slug}`}>{topic.title[lang]}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

import type { FsRouteComponentProps } from "@funstack/static/fs-routes";
import {
  getTopic,
  isLanguage,
  languageNames,
  languages,
  topics,
} from "../../content";

// A page with two dynamic segments. `generateStaticParams()` must return every
// param on the route path — here both `lang` and `topic` — for each page to
// pre-render: `/docs/en/layouts`, `/docs/ja/layouts`, `/docs/en/params`, …
export function generateStaticParams() {
  return languages.flatMap((lang) =>
    topics.map((topic) => ({ lang, topic: topic.slug })),
  );
}

// A Server Component page below a Server Component layout, both under the
// dynamic `[lang]` segment. Switching the language below is a soft navigation
// within the same route: the layout's and the page's pre-rendered outputs for
// the new `lang` are fetched and swapped in together.
export default function DocsTopic({
  params,
}: FsRouteComponentProps<{ lang: string; topic: string }>) {
  const topic = getTopic(params.topic);
  if (!topic || !isLanguage(params.lang)) {
    return <p>Unknown topic.</p>;
  }
  const lang = params.lang;
  return (
    <article>
      <h1>{topic.title[lang]}</h1>
      <p>
        <small>
          <code>pages/docs/[lang]/[topic]/page.tsx</code> — build-time{" "}
          <code>params</code> of this page:{" "}
          <code>{JSON.stringify(params)}</code>
        </small>
      </p>
      <p>{topic.body[lang]}</p>
      <p>
        Read this topic in:{" "}
        {languages
          .filter((candidate) => candidate !== lang)
          .map((candidate) => (
            <a key={candidate} href={`/docs/${candidate}/${topic.slug}`}>
              {languageNames[candidate]}
            </a>
          ))}
      </p>
      <p>
        <a href={`/docs/${lang}`}>All topics</a>
      </p>
    </article>
  );
}

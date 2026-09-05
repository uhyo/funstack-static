// Shared data for the docs routes. Like `blog/posts.ts`, this file is not a
// route file and is ignored by the adapter.
export const languages = ["en", "ja"] as const;
export type Language = (typeof languages)[number];

export const languageNames: Record<Language, string> = {
  en: "English",
  ja: "日本語",
};

export interface Topic {
  slug: string;
  title: Record<Language, string>;
  body: Record<Language, string>;
}

export const topics: Topic[] = [
  {
    slug: "layouts",
    title: { en: "Layouts", ja: "レイアウト" },
    body: {
      en: "A layout.tsx wraps its directory and descendants, and renders <Outlet /> where the child appears.",
      ja: "layout.tsx はそのディレクトリ配下のページをラップし、<Outlet /> の位置に子を描画します。",
    },
  },
  {
    slug: "params",
    title: { en: "Params", ja: "パラメータ" },
    body: {
      en: "A Server Component layout receives only the params of the segments at or above it, so this layout sees { lang } but not { topic }.",
      ja: "Server Component のレイアウトは自身以上のセグメントのパラメータだけを受け取るので、このレイアウトには { lang } のみが渡され { topic } は渡されません。",
    },
  },
];

export function getTopic(slug: string): Topic | undefined {
  return topics.find((topic) => topic.slug === slug);
}

export function isLanguage(value: string): value is Language {
  return (languages as readonly string[]).includes(value);
}

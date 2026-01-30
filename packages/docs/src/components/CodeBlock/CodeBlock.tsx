import { getHighlighter, shikiThemes } from "../../lib/shiki";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
  children: string;
  language?: string;
}

export async function CodeBlock({
  children,
  language = "typescript",
}: CodeBlockProps) {
  const highlighter = await getHighlighter();
  const html = highlighter.codeToHtml(children.trim(), {
    lang: language,
    themes: shikiThemes,
  });

  return (
    <div className={styles.codeBlock}>
      <div
        className={styles.codeContent}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

interface InlineCodeProps {
  children: React.ReactNode;
}

export function InlineCode({ children }: InlineCodeProps) {
  return <code className={styles.inlineCode}>{children}</code>;
}

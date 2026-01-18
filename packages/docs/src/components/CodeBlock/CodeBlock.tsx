import { codeToHtml } from "shiki";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
  children: string;
  language?: string;
}

export async function CodeBlock({
  children,
  language = "typescript",
}: CodeBlockProps) {
  const html = await codeToHtml(children.trim(), {
    lang: language,
    themes: {
      light: "github-light",
      dark: "github-dark",
    },
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

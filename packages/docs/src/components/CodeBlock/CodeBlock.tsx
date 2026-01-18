import type React from "react";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
  children: string;
  language?: string;
  showLineNumbers?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  children,
  language = "typescript",
}) => {
  return (
    <div className={styles.codeBlock}>
      <div className={styles.header}>
        <span className={styles.language}>{language}</span>
        <button type="button" className={styles.copyButton}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="2" />
            <path
              d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
              strokeWidth="2"
            />
          </svg>
          Copy
        </button>
      </div>
      <pre className={styles.pre}>
        <code className={styles.code}>{children}</code>
      </pre>
    </div>
  );
};

interface InlineCodeProps {
  children: React.ReactNode;
}

export const InlineCode: React.FC<InlineCodeProps> = ({ children }) => {
  return <code className={styles.inlineCode}>{children}</code>;
};

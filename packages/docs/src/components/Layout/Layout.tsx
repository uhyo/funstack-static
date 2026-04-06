import type React from "react";
import { Suspense } from "react";
import { siteUrl } from "../../constants";
import { Header } from "../Header/Header";
import { MobileMenu } from "../MobileMenu/MobileMenu";
import { Sidebar } from "../Sidebar/Sidebar";
import { TableOfContents } from "../TableOfContents/TableOfContents";
import styles from "./Layout.module.css";

type LayoutVariant = "home" | "docs";

interface LayoutProps {
  children: React.ReactNode;
  variant?: LayoutVariant;
  title?: string;
  path: string;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  variant = "docs",
  title,
  path,
}) => {
  const layoutClass =
    variant === "home" ? styles.homeLayout : styles.docsLayout;
  const fullTitle = title
    ? `${title} | FUNSTACK Static`
    : "FUNSTACK Static - docs";
  const canonicalUrl = path === "/" ? `${siteUrl}/` : `${siteUrl}${path}`;

  return (
    <div className={`${styles.layout} ${layoutClass}`}>
      <title>{fullTitle}</title>
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <Header menuSlot={<MobileMenu />} />
      <div className={styles.main}>
        {variant === "docs" && <Sidebar />}
        <main
          className={`${styles.content} ${variant === "docs" ? styles.mdxContent : ""}`}
          data-mdx-content={variant === "docs" ? "" : undefined}
        >
          <Suspense fallback={null}>{children}</Suspense>
        </main>
        {variant === "docs" && (
          <aside className={styles.tocContainer}>
            <TableOfContents />
          </aside>
        )}
      </div>
    </div>
  );
};

import type React from "react";
import { Header } from "../Header/Header";
import { MobileMenu } from "../MobileMenu/MobileMenu";
import { Sidebar } from "../Sidebar/Sidebar";
import styles from "./Layout.module.css";
import { Suspense } from "react";

type LayoutVariant = "home" | "docs";

interface LayoutProps {
  children: React.ReactNode;
  variant?: LayoutVariant;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  variant = "docs",
}) => {
  const layoutClass =
    variant === "home" ? styles.homeLayout : styles.docsLayout;

  return (
    <div className={`${styles.layout} ${layoutClass}`}>
      <Header menuSlot={<MobileMenu />} />
      <div className={styles.main}>
        {variant === "docs" && <Sidebar />}
        <main
          className={`${styles.content} ${variant === "docs" ? styles.mdxContent : ""}`}
        >
          <Suspense fallback={null}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
};

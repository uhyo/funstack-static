import type React from "react";
import { Header } from "../Header/Header";
import { Sidebar } from "../Sidebar/Sidebar";
import styles from "./Layout.module.css";

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
      <Header />
      <div className={styles.main}>
        {variant === "docs" && <Sidebar />}
        <main
          className={`${styles.content} ${variant === "docs" ? styles.mdxContent : ""}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

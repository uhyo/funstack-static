import styles from "./Sidebar.module.css";

export interface NavItem {
  label: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    title: "Getting Started",
    items: [
      { label: "Introduction", href: "/getting-started" },
      {
        label: "Migrating from Vite SPA",
        href: "/getting-started/migrating-from-vite-spa",
      },
    ],
  },
  {
    title: "Learn",
    items: [
      {
        label: "React Server Components",
        href: "/learn/rsc",
      },
      {
        label: "How It Works",
        href: "/learn/how-it-works",
      },
      {
        label: "Optimizing RSC Payloads",
        href: "/learn/optimizing-payloads",
      },
      {
        label: "Using lazy() in Server",
        href: "/learn/lazy-server-components",
      },
      {
        label: "Prefetching with Activity",
        href: "/learn/defer-and-activity",
      },
      {
        label: "Multiple Entrypoints",
        href: "/learn/multiple-entrypoints",
      },
      {
        label: "Server-Side Rendering",
        href: "/learn/ssr",
      },
    ],
  },
  {
    title: "API Reference",
    items: [
      {
        label: "funstackStatic()",
        href: "/api/funstack-static",
      },
      { label: "defer()", href: "/api/defer" },
      {
        label: "EntryDefinition",
        href: "/api/entry-definition",
      },
    ],
  },
  {
    title: "Help",
    items: [{ label: "FAQ", href: "/faq" }],
  },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className={styles.sidebar}>
      {navigation.map((section) => (
        <div key={section.title} className={styles.section}>
          <h3 className={styles.sectionTitle}>{section.title}</h3>
          <nav className={styles.navList}>
            {section.items.map((item) => (
              <a key={item.href} href={item.href} className={styles.navItem}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      ))}
    </aside>
  );
};

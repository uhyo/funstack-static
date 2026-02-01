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
      { label: "Introduction", href: "/funstack-static/getting-started" },
    ],
  },
  {
    title: "Learn",
    items: [
      {
        label: "React Server Components",
        href: "/funstack-static/learn/rsc",
      },
      {
        label: "How It Works",
        href: "/funstack-static/learn/how-it-works",
      },
      {
        label: "Optimizing RSC Payloads",
        href: "/funstack-static/learn/optimizing-payloads",
      },
      {
        label: "Using lazy() in Server",
        href: "/funstack-static/learn/lazy-server-components",
      },
      {
        label: "Server-Side Rendering",
        href: "/funstack-static/learn/ssr",
      },
    ],
  },
  {
    title: "API Reference",
    items: [
      {
        label: "funstackStatic()",
        href: "/funstack-static/api/funstack-static",
      },
      { label: "defer()", href: "/funstack-static/api/defer" },
    ],
  },
  {
    title: "Help",
    items: [{ label: "FAQ", href: "/funstack-static/faq" }],
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

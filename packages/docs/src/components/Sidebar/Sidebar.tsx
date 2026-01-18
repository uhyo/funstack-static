import styles from "./Sidebar.module.css";

interface NavItem {
  label: string;
  href: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    title: "Getting Started",
    items: [{ label: "Introduction", href: "/getting-started" }],
  },
  {
    title: "API Reference",
    items: [
      { label: "funstackStatic()", href: "/api/funstack-static" },
      { label: "defer()", href: "/api/defer" },
    ],
  },
  {
    title: "Concepts",
    items: [{ label: "React Server Components", href: "/concepts/rsc" }],
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

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./TableOfContents.module.css";

interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

export const TableOfContents: React.FC = () => {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const currentHeadingIdsRef = useRef<string>("");

  const setupScrollSpy = useCallback(
    (headingElements: NodeListOf<Element>) => {
      // Clean up previous observer
      intersectionObserverRef.current?.disconnect();

      intersectionObserverRef.current = new IntersectionObserver(
        (entries) => {
          const visibleEntries = entries.filter(
            (entry) => entry.isIntersecting,
          );
          if (visibleEntries.length > 0) {
            const sorted = visibleEntries.sort((a, b) => {
              const aRect = a.target.getBoundingClientRect();
              const bRect = b.target.getBoundingClientRect();
              return aRect.top - bRect.top;
            });
            setActiveId(sorted[0].target.id);
          }
        },
        {
          rootMargin: "-80px 0px -80% 0px",
          threshold: 0,
        },
      );

      headingElements.forEach((heading) => {
        if (heading.id) {
          intersectionObserverRef.current?.observe(heading);
        }
      });
    },
    [],
  );

  const extractHeadings = useCallback(
    (container: Element): boolean => {
      const headingElements = container.querySelectorAll("h2, h3");

      const items: HeadingItem[] = [];

      headingElements.forEach((heading) => {
        const id = heading.id;
        if (id) {
          items.push({
            id,
            text: heading.textContent || "",
            level: parseInt(heading.tagName[1], 10),
          });
        }
      });

      // Check if headings actually changed (avoid unnecessary re-renders)
      const newHeadingIds = items.map((h) => h.id).join(",");
      if (newHeadingIds === currentHeadingIdsRef.current) {
        return items.length > 0;
      }
      currentHeadingIdsRef.current = newHeadingIds;

      if (items.length === 0) {
        setHeadings([]);
        setActiveId("");
        intersectionObserverRef.current?.disconnect();
        return false;
      }

      setHeadings(items);
      setActiveId("");
      setupScrollSpy(headingElements);
      return true;
    },
    [setupScrollSpy],
  );

  useEffect(() => {
    const container = document.querySelector("[data-mdx-content]");
    if (!container) return;

    // Try to extract headings immediately
    extractHeadings(container);

    // Watch for content changes (including navigation)
    const mutationObserver = new MutationObserver(() => {
      extractHeadings(container);
    });

    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => {
      mutationObserver.disconnect();
      intersectionObserverRef.current?.disconnect();
    };
  }, [extractHeadings]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className={styles.toc} aria-label="Table of contents">
      <h4 className={styles.title}>On this page</h4>
      <ul className={styles.list}>
        {headings.map((heading) => (
          <li
            key={heading.id}
            className={`${styles.item} ${heading.level === 3 ? styles.nested : ""} ${
              activeId === heading.id ? styles.active : ""
            }`}
          >
            <a href={`#${heading.id}`} className={styles.link}>
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

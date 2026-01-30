import { createHighlighter } from "shiki";

let highlighterPromise: ReturnType<typeof createHighlighter> | null = null;

export function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: ["typescript", "tsx", "bash"],
    });
  }
  return highlighterPromise;
}

export const shikiThemes = {
  light: "github-light",
  dark: "github-dark",
} as const;

/**
 * Generates AI-friendly documentation bundle from the docs package.
 *
 * This script:
 * 1. Copies MDX files from packages/docs/src/pages/ to dist/docs/
 * 2. Renames .mdx to .md
 * 3. Generates an index.md with links to all docs
 *
 * Run with: pnpm build:docs
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_PACKAGE_ROOT = path.resolve(__dirname, "..");
const DOCS_PAGES_DIR = path.resolve(STATIC_PACKAGE_ROOT, "../docs/src/pages");
const OUTPUT_DIR = path.resolve(STATIC_PACKAGE_ROOT, "dist/docs");

interface DocFile {
  /** Relative path from pages dir (e.g., "api/Defer.mdx") */
  relativePath: string;
  /** Output filename without extension (e.g., "api/Defer") */
  outputPath: string;
  /** First heading extracted from the file */
  title: string;
  /** First paragraph or description */
  description: string;
}

/**
 * Recursively finds all .mdx files in a directory
 */
async function findMdxFiles(dir: string, basePath = ""): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = path.join(basePath, entry.name);
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await findMdxFiles(fullPath, relativePath)));
    } else if (entry.name.endsWith(".mdx")) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Extracts the title (first h1) and description (first paragraph) from markdown
 */
function extractMetadata(content: string): {
  title: string;
  description: string;
} {
  const lines = content.split("\n");

  // Find first h1 heading
  let title = "";
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)$/);
    if (match) {
      title = match[1];
      break;
    }
  }

  // Find first non-empty paragraph after the title
  let description = "";
  let foundTitle = false;
  for (const line of lines) {
    if (line.startsWith("# ")) {
      foundTitle = true;
      continue;
    }
    if (
      foundTitle &&
      line.trim() &&
      !line.startsWith("#") &&
      !line.startsWith("```")
    ) {
      description = line.trim();
      break;
    }
  }

  return { title, description };
}

/**
 * Processes a single MDX file: reads, extracts metadata, and prepares for output
 */
async function processFile(relativePath: string): Promise<DocFile> {
  const fullPath = path.join(DOCS_PAGES_DIR, relativePath);
  const content = await fs.readFile(fullPath, "utf-8");
  const { title, description } = extractMetadata(content);

  const outputPath = relativePath.replace(/\.mdx$/, "");

  return {
    relativePath,
    outputPath,
    title: title || path.basename(relativePath, ".mdx"),
    description,
  };
}

/**
 * Copies an MDX file to the output directory as .md
 */
async function copyFile(relativePath: string): Promise<void> {
  const sourcePath = path.join(DOCS_PAGES_DIR, relativePath);
  const outputPath = path.join(
    OUTPUT_DIR,
    relativePath.replace(/\.mdx$/, ".md"),
  );

  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  // Copy file content (MDX is valid MD for our files)
  const content = await fs.readFile(sourcePath, "utf-8");
  await fs.writeFile(outputPath, content, "utf-8");
}

/**
 * Generates the index.md file with links to all docs
 */
function generateIndex(docs: DocFile[]): string {
  // Group docs by category
  const gettingStarted = docs.filter((d) => d.outputPath === "GettingStarted");
  const apiDocs = docs.filter((d) => d.outputPath.startsWith("api/"));
  const learnDocs = docs.filter((d) => d.outputPath.startsWith("learn/"));

  const lines: string[] = [
    "# @funstack/static Documentation",
    "",
    "A Vite plugin for building static sites with React Server Components.",
    "",
    "## Available Documentation",
    "",
  ];

  // Getting Started
  for (const doc of gettingStarted) {
    lines.push(`- [${doc.title}](./${doc.outputPath}.md) - ${doc.description}`);
  }

  // API Reference
  if (apiDocs.length > 0) {
    lines.push("");
    lines.push("### API Reference");
    lines.push("");
    for (const doc of apiDocs) {
      lines.push(
        `- [${doc.title}](./${doc.outputPath}.md) - ${doc.description}`,
      );
    }
  }

  // Learn
  if (learnDocs.length > 0) {
    lines.push("");
    lines.push("### Learn");
    lines.push("");
    for (const doc of learnDocs) {
      lines.push(
        `- [${doc.title}](./${doc.outputPath}.md) - ${doc.description}`,
      );
    }
  }

  lines.push("");

  return lines.join("\n");
}

async function main() {
  console.log("Generating AI-friendly docs bundle...");

  // Find all MDX files
  const mdxFiles = await findMdxFiles(DOCS_PAGES_DIR);
  console.log(`Found ${mdxFiles.length} MDX files`);

  // Process files to extract metadata
  const docs = await Promise.all(mdxFiles.map(processFile));

  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Copy all MDX files as MD
  await Promise.all(mdxFiles.map(copyFile));
  console.log(`Copied ${mdxFiles.length} files to dist/docs/`);

  // Generate index.md
  const indexContent = generateIndex(docs);
  await fs.writeFile(path.join(OUTPUT_DIR, "index.md"), indexContent, "utf-8");
  console.log("Generated index.md");

  console.log("Done!");
}

main().catch((error) => {
  console.error("Error generating docs:", error);
  process.exit(1);
});

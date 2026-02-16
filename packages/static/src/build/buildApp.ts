import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ViteBuilder, MinimalPluginContextWithoutEnvironment } from "vite";
import { rscPayloadPlaceholder, getRscPayloadPath } from "./rscPath";
import { getModulePathFor } from "../rsc/rscModule";
import { processRscComponents } from "./rscProcessor";
import { computeContentHash } from "./contentHash";
import { drainStream } from "../util/drainStream";
import { validateEntryPath, checkDuplicatePaths } from "./validateEntryPath";
import type { EntryBuildResult } from "../rsc/entry";

export async function buildApp(
  builder: ViteBuilder,
  context: MinimalPluginContextWithoutEnvironment,
) {
  const { config } = builder;
  // import server entry
  const entryPath = path.join(config.environments.rsc.build.outDir, "index.js");
  const entry: typeof import("../rsc/entry") = await import(
    pathToFileURL(entryPath).href
  );

  const baseDir = config.environments.client.build.outDir;
  const base = normalizeBase(config.base);

  const { entries, deferRegistry } = await entry.build();

  // Validate all entry paths
  const paths: string[] = [];
  for (const result of entries) {
    const error = validateEntryPath(result.path);
    if (error) {
      throw new Error(error);
    }
    paths.push(result.path);
  }
  const dupError = checkDuplicatePaths(paths);
  if (dupError) {
    throw new Error(dupError);
  }

  // Process all deferred components once across all entries.
  // We pass a dummy empty stream since we handle per-entry RSC payloads separately.
  const dummyStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
  const { components, idMapping } = await processRscComponents(
    deferRegistry.loadAll(),
    dummyStream,
    context,
  );

  // Write each entry's HTML and RSC payload
  for (const result of entries) {
    await buildSingleEntry(result, idMapping, baseDir, base, context);
  }

  // Write all deferred component payloads
  for (const { finalId, finalContent, name } of components) {
    const filePath = path.join(
      baseDir,
      getModulePathFor(finalId).replace(/^\//, ""),
    );
    await writeFileNormal(filePath, finalContent, context, name);
  }
}

function normalizeBase(base: string): string {
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return normalized === "/" ? "" : normalized;
}

/**
 * Replaces temporary IDs with final hashed IDs in content.
 */
function replaceIdsInContent(
  content: string,
  idMapping: Map<string, string>,
): string {
  let result = content;
  for (const [oldId, newId] of idMapping) {
    if (oldId !== newId) {
      result = result.replaceAll(oldId, newId);
    }
  }
  return result;
}

async function buildSingleEntry(
  result: EntryBuildResult,
  idMapping: Map<string, string>,
  baseDir: string,
  base: string,
  context: MinimalPluginContextWithoutEnvironment,
) {
  const { path: entryPath, html, appRsc } = result;

  // Drain HTML stream to string
  const htmlContent = await drainStream(html);

  // Drain and process RSC payload: replace temp IDs with final hashed IDs
  const rawAppRscContent = await drainStream(appRsc);
  const appRscContent = replaceIdsInContent(rawAppRscContent, idMapping);

  // Compute hash for this entry's RSC payload
  const mainPayloadHash = await computeContentHash(appRscContent);
  const mainPayloadPath =
    base === ""
      ? getRscPayloadPath(mainPayloadHash)
      : base + getRscPayloadPath(mainPayloadHash);

  // Replace placeholder with final hashed path
  const finalHtmlContent = htmlContent.replaceAll(
    rscPayloadPlaceholder,
    mainPayloadPath,
  );

  // entryPath is already a file name (e.g. "index.html", "about.html")
  await writeFileNormal(
    path.join(baseDir, entryPath),
    finalHtmlContent,
    context,
  );

  // Write RSC payload with hashed filename
  await writeFileNormal(
    path.join(baseDir, getRscPayloadPath(mainPayloadHash).replace(/^\//, "")),
    appRscContent,
    context,
  );
}

async function writeFileNormal(
  filePath: string,
  data: string,
  context: MinimalPluginContextWithoutEnvironment,
  name?: string,
) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const nameInfo = name ? ` (${name})` : "";
  context.info(`[funstack] Writing ${filePath}${nameInfo}`);
  await writeFile(filePath, data);
}

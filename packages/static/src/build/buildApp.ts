import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ViteBuilder, MinimalPluginContextWithoutEnvironment } from "vite";
import { rscPayloadPlaceholder, getRscPayloadPath } from "./rscPath";
import { getModulePathFor } from "../rsc/rscModule";
import { processRscComponents } from "./rscProcessor";
import { computeContentHash } from "./contentHash";
import { drainStream } from "../util/drainStream";

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

  // render rsc and html
  const baseDir = config.environments.client.build.outDir;
  const { html, appRsc, deferRegistry } = await entry.build();

  // Drain HTML stream to string (needed for placeholder replacement later)
  const htmlContent = await drainStream(html);

  // Process RSC components with content-based hashes for deterministic file names
  const { components, appRscContent } = await processRscComponents(
    deferRegistry.loadAll(),
    appRsc,
    context,
  );

  // Compute hash for main RSC payload and apply base path
  const mainPayloadHash = await computeContentHash(appRscContent);
  const base = config.base.endsWith("/")
    ? config.base.slice(0, -1)
    : config.base;
  const mainPayloadPath =
    base === "/"
      ? getRscPayloadPath(mainPayloadHash)
      : base + getRscPayloadPath(mainPayloadHash);

  // Replace placeholder with final hashed path (including base path)
  const finalHtmlContent = htmlContent.replaceAll(
    rscPayloadPlaceholder,
    mainPayloadPath,
  );

  // Write HTML with replaced path
  await writeFileNormal(
    path.join(baseDir, "index.html"),
    finalHtmlContent,
    context,
  );

  // Write main RSC payload with hashed filename
  await writeFileNormal(
    path.join(baseDir, getRscPayloadPath(mainPayloadHash).replace(/^\//, "")),
    appRscContent,
    context,
  );

  // Write processed components with hash-based IDs
  for (const { finalId, finalContent } of components) {
    const filePath = path.join(
      baseDir,
      getModulePathFor(finalId).replace(/^\//, ""),
    );
    await writeFileNormal(filePath, finalContent, context);
  }
}

async function writeFileNormal(
  filePath: string,
  data: string,
  context: MinimalPluginContextWithoutEnvironment,
) {
  await mkdir(path.dirname(filePath), { recursive: true });
  context.info(`[funstack] Writing ${filePath}`);
  await writeFile(filePath, data);
}

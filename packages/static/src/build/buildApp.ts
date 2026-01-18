import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { pathToFileURL } from "node:url";
import type { ViteBuilder, MinimalPluginContextWithoutEnvironment } from "vite";
import { rscPayloadPath } from "./rscPath";
import { getModulePathFor } from "../rsc/rscModule";

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
  const { html, appRsc, sendRegistry } = await entry.build();
  await writeFileStream(path.join(baseDir, "index.html"), html, context);
  await writeFileStream(
    path.join(baseDir, rscPayloadPath.replace(/^\//, "")),
    appRsc,
    context,
  );
  for await (const { id, data } of sendRegistry.loadAll()) {
    const filePath = path.join(
      baseDir,
      getModulePathFor(id).replace(/^\//, ""),
    );
    await writeFileNormal(filePath, data, context);
  }
}

async function writeFileStream(
  filePath: string,
  stream: ReadableStream,
  context: MinimalPluginContextWithoutEnvironment,
) {
  await mkdir(path.dirname(filePath), { recursive: true });
  context.info(`[funstack] Writing ${filePath}`);
  await writeFile(filePath, Readable.fromWeb(stream as NodeWebReadableStream));
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

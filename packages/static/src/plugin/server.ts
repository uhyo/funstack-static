import { isRunnableDevEnvironment, type Plugin } from "vite";
import { readFile } from "node:fs/promises";
import { toNodeHandler } from "srvx/node";
import path from "node:path";
import { getRSCEntryPoint } from "./getRSCEntryPoint";
import { urlPathToFileCandidates } from "../util/urlPath";

export const serverPlugin = (): Plugin => {
  let resolvedOutDir = "__uninitialized__";
  return {
    name: "@funstack/static:server",
    configResolved(config) {
      resolvedOutDir = path.resolve(
        config.root,
        config.environments.client.build.outDir,
      );
    },
    configureServer(server) {
      const rscEnv = server.environments.rsc;
      if (!isRunnableDevEnvironment(rscEnv)) {
        throw new Error("The rsc environment is not runnable");
      }

      return () => {
        server.middlewares.use(async (req, res, next) => {
          try {
            const rscEntry = await getRSCEntryPoint(rscEnv);
            if (req.headers.accept?.includes("text/html")) {
              // serveHTML now accepts a Request and routes by URL path
              const fetchHandler = toNodeHandler(rscEntry.serveHTML);
              await fetchHandler(req as any, res as any);
              return;
            }
            const fetchHandler = toNodeHandler(rscEntry.serveRSC);
            try {
              await fetchHandler(req as any, res as any);
            } catch (error) {
              if (rscEntry.isServeRSCError(error) && error.status === 404) {
                next();
                return;
              }
              next(error);
            }
          } catch (error) {
            next(error);
          }
        });
      };
    },
    configurePreviewServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          try {
            if (req.headers.accept?.includes("text/html")) {
              const urlPath = new URL(req.url!, `http://${req.headers.host}`)
                .pathname;
              // Entry files matching the URL path, followed by the SPA
              // fallback (index.html / index.htm) for unmatched routes.
              const candidates = [
                ...new Set([
                  ...urlPathToFileCandidates(urlPath),
                  "index.html",
                  "index.htm",
                ]),
              ];
              for (const candidate of candidates) {
                try {
                  const html = await readFile(
                    path.join(resolvedOutDir, candidate),
                    "utf-8",
                  );
                  res.setHeader("Content-Type", "text/html; charset=utf-8");
                  res.end(html);
                  return;
                } catch {
                  // Try next candidate
                }
              }
              next();
              return;
            }
          } catch (error) {
            next(error);
            return;
          }
          next();
        });
      };
    },
  };
};

import { isRunnableDevEnvironment, type Plugin } from "vite";
import { readFile } from "node:fs/promises";
import { toNodeHandler } from "srvx/node";
import path from "node:path";
import { getRSCEntryPoint } from "./getRSCEntryPoint";

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
          if (!req.headers.accept?.includes("text/html")) {
            next();
            return;
          }
          try {
            const rscEntry = await getRSCEntryPoint(rscEnv);
            const fetchHandler = toNodeHandler(rscEntry.serveHTML);

            await fetchHandler(req as any, res as any);
            return;
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
              const html = await readFile(
                path.join(resolvedOutDir, "index.html"),
                "utf-8",
              );
              res.end(html);
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

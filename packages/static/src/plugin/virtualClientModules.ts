import { isRunnableDevEnvironment, type Plugin } from "vite";
import { getRSCEntryPoint } from "./getRSCEntryPoint";

const prefix = "virtual:funstack/rsc/";

export function virtualClientModulesPlugin(): Plugin {
  return {
    name: "@funstack/static:virtual-client-modules",
    applyToEnvironment(environment) {
      return environment.name === "rsc";
    },
    async resolveId(id) {
      if (!id.startsWith(prefix)) {
        return null;
      }
      const environment = this.environment;
      if (!isRunnableDevEnvironment(environment)) {
        return;
      }
      const rawId = id.slice(prefix.length);
      const rscEntry = await getRSCEntryPoint(environment);
      if (!rscEntry.sendRegistry.has(rawId)) {
        return null;
      }
      return `\0${id}`;
    },
    async load(id) {
      if (!id.startsWith(`\0${prefix}`)) {
        return null;
      }
      const rawId = id.slice(1 + prefix.length);
      const environment = this.environment;
      if (!isRunnableDevEnvironment(environment)) {
        return;
      }
      const rscEntry = await getRSCEntryPoint(environment);
      const moduleContents = await rscEntry.serveRSC(rawId);
      return moduleContents;
    },
  };
}

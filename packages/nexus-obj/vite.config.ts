import { createLibraryConfig } from "../../vite.config.base";

export default createLibraryConfig({
  entry: "src/index.ts",
  packageName: "NexusObj",
  external: ["nexus-core"],
});

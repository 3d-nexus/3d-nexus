import { createLibraryConfig } from "../../vite.config.base";

export default createLibraryConfig({
  entry: "src/index.ts",
  packageName: "NexusMmd",
  external: ["@3d-nexus/core"],
});

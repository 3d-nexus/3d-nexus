import { createLibraryConfig } from "../../vite.config.base";

export default createLibraryConfig({
  entry: "src/index.ts",
  packageName: "NexusConverter",
  external: ["nexus-core", "nexus-obj", "nexus-mmd", "nexus-fbx"],
});

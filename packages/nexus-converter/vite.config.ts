import { createLibraryConfig } from "../../vite.config.base";

export default createLibraryConfig({
  entry: "src/index.ts",
  packageName: "NexusConverter",
  external: ["@3d-nexus/bvh", "@3d-nexus/core", "@3d-nexus/obj", "@3d-nexus/mmd", "@3d-nexus/fbx"],
});

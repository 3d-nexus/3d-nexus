import type { BaseExporter, BaseImporter } from "nexus-core";
import { BVHExporter, BVHImporter } from "nexus-bvh";
import { FBXExporter, FBXImporter } from "nexus-fbx";
import { MMDExporter, MMDImporter } from "nexus-mmd";
import { ObjExporter, ObjFileImporter } from "nexus-obj";

export const ModelFormat = {
  OBJ: "obj",
  FBX: "fbx",
  PMX: "pmx",
  PMD: "pmd",
  VMD: "vmd",
  BVH: "bvh",
} as const;

export type ModelFormat = (typeof ModelFormat)[keyof typeof ModelFormat];

export const IMPORTER_REGISTRY: Record<ModelFormat, BaseImporter> = {
  obj: new ObjFileImporter(),
  fbx: new FBXImporter(),
  pmx: new MMDImporter(),
  pmd: new MMDImporter(),
  vmd: new MMDImporter(),
  bvh: new BVHImporter(),
};

export const EXPORTER_REGISTRY: Record<ModelFormat, BaseExporter> = {
  obj: new ObjExporter(),
  fbx: new FBXExporter(),
  pmx: new MMDExporter(),
  pmd: new MMDExporter(),
  vmd: new MMDExporter(),
  bvh: new BVHExporter(),
};

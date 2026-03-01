import type { AiAnimation } from "./anim";
import type { AiCamera } from "./camera";
import type { AiLight } from "./light";
import type { AiMaterial } from "./material";
import type { AiMetadata } from "./metadata";
import type { AiMesh } from "./mesh";
import type { AiMatrix4x4 } from "./math";
import type { AiTexture } from "./texture";

export enum AiSceneFlags {
  AI_SCENE_FLAGS_INCOMPLETE = 0x1,
  AI_SCENE_FLAGS_VALIDATED = 0x2,
  AI_SCENE_FLAGS_VALIDATION_WARNING = 0x4,
  AI_SCENE_FLAGS_NON_VERBOSE_FORMAT = 0x8,
  AI_SCENE_FLAGS_TERRAIN = 0x10,
  AI_SCENE_FLAGS_ALLOW_SHARED = 0x20,
}

export interface AiNode {
  name: string;
  transformation: AiMatrix4x4;
  parent: AiNode | null;
  children: AiNode[];
  meshIndices: number[];
  metadata?: AiMetadata | null;
}

export interface AiScene {
  flags: AiSceneFlags;
  rootNode: AiNode;
  meshes: AiMesh[];
  materials: AiMaterial[];
  animations: AiAnimation[];
  textures: AiTexture[];
  lights: AiLight[];
  cameras: AiCamera[];
  metadata: AiMetadata;
}

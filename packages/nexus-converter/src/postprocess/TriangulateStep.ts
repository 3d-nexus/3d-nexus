import { type AiScene } from "@3d-nexus/core";
import type { PostProcessStep } from "./PostProcessStep";

export class TriangulateStep implements PostProcessStep {
  process(scene: AiScene): AiScene {
    return {
      ...scene,
      meshes: scene.meshes.map((mesh) => ({
        ...mesh,
        faces: mesh.faces.flatMap((face) => {
          if (face.indices.length <= 3) {
            return [face];
          }
          return Array.from({ length: face.indices.length - 2 }, (_, index) => ({
            indices: [face.indices[0]!, face.indices[index + 1]!, face.indices[index + 2]!],
          }));
        }),
      })),
    };
  }
}


import { AiPrimitiveType, type AiScene } from "@3d-nexus/core";
import type { PostProcessStep } from "./PostProcessStep";

export class SortByPTypeStep implements PostProcessStep {
  process(scene: AiScene): AiScene {
    return {
      ...scene,
      meshes: scene.meshes.flatMap((mesh) => {
        const groups = new Map<AiPrimitiveType, typeof mesh.faces>();
        mesh.faces.forEach((face) => {
          const type =
            face.indices.length === 1
              ? AiPrimitiveType.POINT
              : face.indices.length === 2
                ? AiPrimitiveType.LINE
                : AiPrimitiveType.TRIANGLE;
          const faces = groups.get(type) ?? [];
          faces.push(face);
          groups.set(type, faces);
        });
        return [...groups.entries()].map(([primitiveTypes, faces]) => ({
          ...mesh,
          primitiveTypes,
          faces,
        }));
      }),
    };
  }
}


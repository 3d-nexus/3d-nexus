import { type AiScene } from "@3d-nexus/core";
import type { PostProcessStep } from "./PostProcessStep";

export class FlipUVsStep implements PostProcessStep {
  process(scene: AiScene): AiScene {
    return {
      ...scene,
      meshes: scene.meshes.map((mesh) => ({
        ...mesh,
        textureCoords: mesh.textureCoords.map((channel) =>
          channel?.map((uv) => ({ ...uv, y: 1 - uv.y })) ?? null,
        ),
      })),
    };
  }
}


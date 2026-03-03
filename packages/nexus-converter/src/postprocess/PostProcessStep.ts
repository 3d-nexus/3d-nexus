import type { AiScene } from "@3d-nexus/core";

export interface PostProcessStep {
  process(scene: AiScene): AiScene;
}


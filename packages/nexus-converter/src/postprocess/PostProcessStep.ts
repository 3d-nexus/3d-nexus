import type { AiScene } from "nexus-core";

export interface PostProcessStep {
  process(scene: AiScene): AiScene;
}

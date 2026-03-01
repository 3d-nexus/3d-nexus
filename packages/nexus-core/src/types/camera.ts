import type { AiVector3D } from "./math";

export interface AiCamera {
  name: string;
  position: AiVector3D;
  up: AiVector3D;
  lookAt: AiVector3D;
  horizontalFov: number;
  clipPlaneNear: number;
  clipPlaneFar: number;
  aspect: number;
}

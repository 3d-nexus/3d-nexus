import type { AiColor3D, AiVector3D } from "./math";

export enum AiLightSourceType {
  UNDEFINED = 0,
  DIRECTIONAL = 1,
  POINT = 2,
  SPOT = 3,
  AMBIENT = 4,
  AREA = 5,
}

export interface AiLight {
  name: string;
  type: AiLightSourceType;
  position: AiVector3D;
  direction: AiVector3D;
  up: AiVector3D;
  diffuseColor: AiColor3D;
  specularColor: AiColor3D;
  ambientColor: AiColor3D;
  angleInnerCone: number;
  angleOuterCone: number;
}

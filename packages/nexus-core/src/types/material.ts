import type { AiColor3D, AiColor4D, AiVector2D } from "./math";

export enum AiTextureType {
  NONE = 0,
  DIFFUSE = 1,
  SPECULAR = 2,
  AMBIENT = 3,
  EMISSIVE = 4,
  HEIGHT = 5,
  NORMALS = 6,
  SHININESS = 7,
  OPACITY = 8,
  DISPLACEMENT = 9,
  LIGHTMAP = 10,
  REFLECTION = 11,
  BASE_COLOR = 12,
}

export enum AiTextureMapping {
  UV = 0,
  SPHERE = 1,
  CYLINDER = 2,
  BOX = 3,
  PLANE = 4,
  OTHER = 5,
}

export enum AiPropertyTypeInfo {
  FLOAT = 0,
  DOUBLE = 1,
  STRING = 2,
  INTEGER = 3,
  BUFFER = 4,
}

export interface AiUVTransform {
  translation: AiVector2D;
  scaling: AiVector2D;
  rotation: number;
}

export interface AiMaterialProperty {
  key: string;
  semantic: AiTextureType;
  index: number;
  type: AiPropertyTypeInfo;
  data: unknown;
}

export interface AiMaterial {
  name: string;
  properties: AiMaterialProperty[];
  metadata?: Record<string, unknown>;
}

export type AiMaterialColor = AiColor3D | AiColor4D;

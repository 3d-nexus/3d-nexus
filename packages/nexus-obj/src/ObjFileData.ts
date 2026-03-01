import type { AiColor3D, AiVector2D, AiVector3D } from "nexus-core";

export interface ObjFaceVertex {
  vertexIndex: number;
  textureIndex: number;
  normalIndex: number;
}

export interface ObjFace {
  vertices: ObjFaceVertex[];
  materialName: string | null;
  objectName: string;
  groupName: string;
  smoothingGroup: string | null;
}

export interface ObjGroup {
  name: string;
  materialName: string | null;
  faces: ObjFace[];
}

export interface ObjObject {
  name: string;
  groups: ObjGroup[];
}

export interface ObjMaterial {
  name: string;
  ambient?: AiColor3D;
  diffuse?: AiColor3D;
  specular?: AiColor3D;
  emissive?: AiColor3D;
  shininess?: number;
  opticalDensity?: number;
  dissolve?: number;
  illuminationModel?: number;
  textureAmbient?: string;
  textureDiffuse?: string;
  textureSpecular?: string;
  textureShininess?: string;
  textureBump?: string;
  textureAlpha?: string;
  displacement?: string;
}

export interface ObjModel {
  vertices: AiVector3D[];
  normals: AiVector3D[];
  textureCoords: AiVector2D[];
  objects: ObjObject[];
  materialLibraries: string[];
  materials: ObjMaterial[];
}

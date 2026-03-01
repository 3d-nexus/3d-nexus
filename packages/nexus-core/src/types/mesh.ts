import type { AiMatrix4x4, AiAABB, AiColor4D, AiVector3D } from "./math";
import type { AiNode } from "./scene";

export enum AiPrimitiveType {
  POINT = 0x1,
  LINE = 0x2,
  TRIANGLE = 0x4,
  POLYGON = 0x8,
}

export interface AiFace {
  indices: number[];
}

export interface AiVertexWeight {
  vertexId: number;
  weight: number;
}

export interface SdefCoeffs {
  type: "sdef";
  c: AiVector3D;
  r0: AiVector3D;
  r1: AiVector3D;
}

export interface AiBone {
  name: string;
  weights: AiVertexWeight[];
  offsetMatrix: AiMatrix4x4;
  node?: AiNode | null;
  // MMD SDEF vertices store extra dual-quaternion coefficients here.
  ikChain?: unknown;
}

export interface AiAnimMesh {
  name: string;
  vertices: AiVector3D[];
  normals: AiVector3D[];
  tangents: AiVector3D[];
  bitangents: AiVector3D[];
  colors: Array<AiColor4D[] | null>;
  textureCoords: Array<AiVector3D[] | null>;
  weight: number;
}

export interface AiMesh {
  name: string;
  primitiveTypes: AiPrimitiveType;
  vertices: AiVector3D[];
  normals: AiVector3D[];
  tangents: AiVector3D[];
  bitangents: AiVector3D[];
  textureCoords: Array<AiVector3D[] | null>;
  colors: Array<AiColor4D[] | null>;
  faces: AiFace[];
  bones: AiBone[];
  materialIndex: number;
  morphTargets: AiAnimMesh[];
  aabb: AiAABB;
}

import type { AiQuaternion, AiVector3D } from "./math";

export enum AiAnimBehaviour {
  DEFAULT = 0,
  CONSTANT = 1,
  LINEAR = 2,
  REPEAT = 3,
}

export enum AiAnimInterpolation {
  STEP = 0,
  LINEAR = 1,
  SPHERICAL_LINEAR = 2,
  CUBIC_SPLINE = 3,
}

export interface AiVectorKey {
  time: number;
  value: AiVector3D;
  interpolation?: AiAnimInterpolation;
}

export interface AiQuatKey {
  time: number;
  value: AiQuaternion;
  interpolation?: AiAnimInterpolation;
}

export interface AiMeshKey {
  time: number;
  value: number;
}

export interface AiMeshMorphKey {
  time: number;
  values: number[];
  weights: number[];
}

export interface AiNodeAnim {
  nodeName: string;
  positionKeys: AiVectorKey[];
  rotationKeys: AiQuatKey[];
  scalingKeys: AiVectorKey[];
  preState: AiAnimBehaviour;
  postState: AiAnimBehaviour;
}

export interface AiMeshAnim {
  name: string;
  keys: AiMeshKey[];
}

export interface AiMeshMorphAnim {
  name: string;
  keys: AiMeshMorphKey[];
}

export interface AiAnimation {
  name: string;
  duration: number;
  ticksPerSecond: number;
  channels: AiNodeAnim[];
  meshChannels: AiMeshAnim[];
  morphMeshChannels: AiMeshMorphAnim[];
}

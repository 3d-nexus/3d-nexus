export interface AiVector2D {
  x: number;
  y: number;
}

export interface AiVector3D {
  x: number;
  y: number;
  z: number;
}

export interface AiColor3D {
  r: number;
  g: number;
  b: number;
}

export interface AiColor4D {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface AiQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface AiMatrix3x3 {
  data: Float32Array;
}

export interface AiMatrix4x4 {
  data: Float32Array;
}

export interface AiAABB {
  min: AiVector3D;
  max: AiVector3D;
}

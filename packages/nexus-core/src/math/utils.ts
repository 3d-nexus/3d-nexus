import type { AiMatrix4x4, AiVector3D } from "../types/math";

export function createIdentityMatrix4x4(): AiMatrix4x4 {
  return {
    data: new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]),
  };
}

export function createTranslationMatrix4x4(x: number, y: number, z: number): AiMatrix4x4 {
  return {
    data: new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1,
    ]),
  };
}

export function createScalingMatrix4x4(x: number, y: number, z: number): AiMatrix4x4 {
  return {
    data: new Float32Array([
      x, 0, 0, 0,
      0, y, 0, 0,
      0, 0, z, 0,
      0, 0, 0, 1,
    ]),
  };
}

export function createRotationXMatrix4x4(radians: number): AiMatrix4x4 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return {
    data: new Float32Array([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    ]),
  };
}

export function createRotationYMatrix4x4(radians: number): AiMatrix4x4 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return {
    data: new Float32Array([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ]),
  };
}

export function createRotationZMatrix4x4(radians: number): AiMatrix4x4 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return {
    data: new Float32Array([
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]),
  };
}

export function createEulerRotationMatrix4x4(
  xDegrees: number,
  yDegrees: number,
  zDegrees: number,
  order = "XYZ",
): AiMatrix4x4 {
  const radians = {
    X: (xDegrees * Math.PI) / 180,
    Y: (yDegrees * Math.PI) / 180,
    Z: (zDegrees * Math.PI) / 180,
  };
  const rotations: Record<string, AiMatrix4x4> = {
    X: createRotationXMatrix4x4(radians.X),
    Y: createRotationYMatrix4x4(radians.Y),
    Z: createRotationZMatrix4x4(radians.Z),
  };

  return [...order].reduce((acc, axis) => multiplyMatrix4x4(acc, rotations[axis] ?? createIdentityMatrix4x4()), createIdentityMatrix4x4());
}

export function multiplyMatrix4x4(left: AiMatrix4x4, right: AiMatrix4x4): AiMatrix4x4 {
  const out = new Float32Array(16);
  const a = left.data;
  const b = right.data;

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0;
      for (let k = 0; k < 4; k += 1) {
        value += a[k * 4 + row]! * b[column * 4 + k]!;
      }
      out[column * 4 + row] = value;
    }
  }

  return { data: out };
}

export function invertMatrix4x4(matrix: AiMatrix4x4): AiMatrix4x4 {
  const m = matrix.data;
  const out = new Float32Array(16);

  const a00 = m[0]!, a01 = m[1]!, a02 = m[2]!, a03 = m[3]!;
  const a10 = m[4]!, a11 = m[5]!, a12 = m[6]!, a13 = m[7]!;
  const a20 = m[8]!, a21 = m[9]!, a22 = m[10]!, a23 = m[11]!;
  const a30 = m[12]!, a31 = m[13]!, a32 = m[14]!, a33 = m[15]!;

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  const determinant =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!determinant) {
    return createIdentityMatrix4x4();
  }

  const invDet = 1 / determinant;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
  out[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * invDet;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
  out[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * invDet;
  out[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * invDet;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
  out[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * invDet;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
  out[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * invDet;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
  out[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * invDet;
  out[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * invDet;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
  out[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * invDet;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;

  return { data: out };
}

export function transformVector3(matrix: AiMatrix4x4, vector: AiVector3D): AiVector3D {
  const m = matrix.data;
  return {
    x: m[0]! * vector.x + m[4]! * vector.y + m[8]! * vector.z + m[12]!,
    y: m[1]! * vector.x + m[5]! * vector.y + m[9]! * vector.z + m[13]!,
    z: m[2]! * vector.x + m[6]! * vector.y + m[10]! * vector.z + m[14]!,
  };
}

export function normalizeVector3(vector: AiVector3D): AiVector3D {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!length) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

export function determinant3x3FromMatrix4x4(matrix: AiMatrix4x4): number {
  const m = matrix.data;
  return (
    m[0]! * (m[5]! * m[10]! - m[6]! * m[9]!) -
    m[4]! * (m[1]! * m[10]! - m[2]! * m[9]!) +
    m[8]! * (m[1]! * m[6]! - m[2]! * m[5]!)
  );
}

import { describe, expect, it } from "vitest";
import {
  createIdentityMatrix4x4,
  createScalingMatrix4x4,
  createTranslationMatrix4x4,
  determinant3x3FromMatrix4x4,
  invertMatrix4x4,
  multiplyMatrix4x4,
  normalizeVector3,
  transformVector3,
} from "../math/utils";

function expectMatrixCloseTo(actual: Float32Array, expected: number[]): void {
  expect(Array.from(actual)).toHaveLength(expected.length);
  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value);
  });
}

describe("math utilities", () => {
  it("creates identity, translation, and scaling transforms", () => {
    expectMatrixCloseTo(createIdentityMatrix4x4().data, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

    expect(transformVector3(createTranslationMatrix4x4(2, 3, 4), { x: 1, y: 1, z: 1 })).toEqual({
      x: 3,
      y: 4,
      z: 5,
    });
    expect(transformVector3(createScalingMatrix4x4(2, 3, 4), { x: 1, y: 2, z: 3 })).toEqual({
      x: 2,
      y: 6,
      z: 12,
    });
  });

  it("multiplies and inverts affine matrices", () => {
    const transform = multiplyMatrix4x4(createTranslationMatrix4x4(5, -2, 3), createScalingMatrix4x4(2, 3, 4));
    const inverse = invertMatrix4x4(transform);
    const identity = multiplyMatrix4x4(transform, inverse);

    expect(transformVector3(transform, { x: 1, y: 1, z: 1 })).toEqual({
      x: 7,
      y: 1,
      z: 7,
    });
    expectMatrixCloseTo(identity.data, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  it("normalizes vectors and computes upper-left 3x3 determinants", () => {
    expect(normalizeVector3({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
    const normalized = normalizeVector3({ x: 3, y: 4, z: 0 });
    expect(normalized.x).toBeCloseTo(0.6);
    expect(normalized.y).toBeCloseTo(0.8);
    expect(normalized.z).toBeCloseTo(0);
    expect(determinant3x3FromMatrix4x4(createScalingMatrix4x4(2, 3, 4))).toBe(24);
    expect(determinant3x3FromMatrix4x4(createScalingMatrix4x4(-1, 1, 1))).toBe(-1);
  });
});

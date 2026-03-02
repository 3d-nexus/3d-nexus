import { describe, expect, it } from "vitest";
import type { PmxDocument } from "../MMDPmxParser";
import { buildPmxBones } from "../MMDImporter";

function createDocument(vertexSkinning: Array<{ skinningType: number; skinning: unknown }>): PmxDocument {
  return {
    setting: {
      version: 2,
      encoding: 1,
      additionalUvCount: 0,
      vertexIndexSize: 4,
      textureIndexSize: 4,
      materialIndexSize: 4,
      boneIndexSize: 4,
      morphIndexSize: 4,
      rigidBodyIndexSize: 4,
    },
    modelName: "skinning",
    englishModelName: "skinning",
    comment: "",
    englishComment: "",
    vertices: vertexSkinning.map((entry, index) => ({
      position: [index, 0, 0],
      normal: [0, 1, 0],
      uv: [0, 0],
      additionalUvs: [],
      skinningType: entry.skinningType,
      skinning: entry.skinning,
      edgeScale: 1,
    })),
    indices: [0, 0, 0],
    textures: [],
    materials: [],
    bones: [
      { name: "Bone0", englishName: "Bone0", position: [0, 0, 0], parentIndex: -1, layer: 0, flags: 0 },
      { name: "Bone1", englishName: "Bone1", position: [0, 0, 0], parentIndex: -1, layer: 0, flags: 0 },
      { name: "Bone2", englishName: "Bone2", position: [0, 0, 0], parentIndex: -1, layer: 0, flags: 0 },
      { name: "Bone3", englishName: "Bone3", position: [0, 0, 0], parentIndex: -1, layer: 0, flags: 0 },
    ],
    morphs: [],
    rigidBodies: [],
    joints: [],
    displayFrames: [],
    softBodies: [],
  };
}

describe("PMX skinning import", () => {
  it("splits BDEF2 weights", () => {
    const warnings: Array<{ code: string; message: string }> = [];
    const document = createDocument([
      {
        skinningType: 1,
        skinning: { boneIndex1: 0, boneIndex2: 1, weight: 0.7 },
      },
    ]);

    const bones = buildPmxBones(document, warnings);
    expect(bones[0]?.weights[0]?.vertexId).toBe(0);
    expect(bones[0]?.weights[0]?.weight).toBeCloseTo(0.7);
    expect(bones[1]?.weights[0]?.vertexId).toBe(0);
    expect(bones[1]?.weights[0]?.weight).toBeCloseTo(0.3);
  });

  it("normalizes BDEF4 weights", () => {
    const warnings: Array<{ code: string; message: string }> = [];
    const document = createDocument([
      {
        skinningType: 2,
        skinning: {
          bones: [
            { boneIndex: 0, weight: 2 },
            { boneIndex: 1, weight: 2 },
            { boneIndex: 2, weight: 2 },
            { boneIndex: 3, weight: 2 },
          ],
        },
      },
    ]);

    const bones = buildPmxBones(document, warnings);
    expect(bones.slice(0, 4).map((bone) => bone.weights[0]?.weight)).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  it("preserves SDEF coefficients on the primary bone", () => {
    const warnings: Array<{ code: string; message: string }> = [];
    const document = createDocument([
      {
        skinningType: 3,
        skinning: {
          boneIndex1: 0,
          boneIndex2: 1,
          weight: 0.6,
          c: [1, 2, 3],
          r0: [4, 5, 6],
          r1: [7, 8, 9],
        },
      },
    ]);

    const bones = buildPmxBones(document, warnings);
    expect(bones[0]?.ikChain).toMatchObject({
      type: "sdef",
      c: { x: 1, y: 2, z: 3 },
      r0: { x: 4, y: 5, z: 6 },
      r1: { x: 7, y: 8, z: 9 },
    });
    expect(bones[0]?.weights[0]?.weight).toBe(0.6);
    expect(bones[1]?.weights[0]?.weight).toBeCloseTo(0.4);
  });
});

import { describe, expect, it } from "vitest";
import { AiPrimitiveType, type AiScene } from "nexus-core";
import { FlipUVsStep } from "../postprocess/FlipUVsStep";
import { GenerateNormalsStep } from "../postprocess/GenerateNormalsStep";
import { OptimizeMeshesStep } from "../postprocess/OptimizeMeshesStep";
import { SortByPTypeStep } from "../postprocess/SortByPTypeStep";
import { TriangulateStep } from "../postprocess/TriangulateStep";

const baseScene: AiScene = {
  flags: 0 as never,
  rootNode: {
    name: "Root",
    transformation: { data: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) },
    parent: null,
    children: [],
    meshIndices: [0],
    metadata: null,
  },
  meshes: [
    {
      name: "Quad",
      primitiveTypes: AiPrimitiveType.POLYGON,
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      normals: [],
      tangents: [],
      bitangents: [],
      textureCoords: [[{ x: 0, y: 0, z: 0 }], null, null, null, null, null, null, null],
      colors: Array.from({ length: 8 }, () => null),
      faces: [{ indices: [0, 1, 2, 3] }, { indices: [0, 1] }],
      bones: [],
      materialIndex: 0,
      morphTargets: [],
      aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
    },
    {
      name: "Quad2",
      primitiveTypes: AiPrimitiveType.TRIANGLE,
      vertices: [{ x: 2, y: 0, z: 0 }],
      normals: [],
      tangents: [],
      bitangents: [],
      textureCoords: [null, null, null, null, null, null, null, null],
      colors: Array.from({ length: 8 }, () => null),
      faces: [{ indices: [0] }],
      bones: [],
      materialIndex: 0,
      morphTargets: [],
      aabb: { min: { x: 2, y: 0, z: 0 }, max: { x: 2, y: 0, z: 0 } },
    },
  ],
  materials: [{ name: "Default", properties: [] }],
  animations: [],
  textures: [],
  lights: [],
  cameras: [],
  metadata: {},
};

describe("postprocess steps", () => {
  it("triangulates polygon faces", () => {
    const scene = new TriangulateStep().process(baseScene);
    expect(scene.meshes[0]?.faces.every((face) => face.indices.length <= 3)).toBe(true);
  });

  it("generates normals", () => {
    const scene = new GenerateNormalsStep().process(baseScene);
    expect(scene.meshes[0]?.normals.length).toBe(baseScene.meshes[0]?.vertices.length);
  });

  it("flips UVs", () => {
    const scene = new FlipUVsStep().process(baseScene);
    expect(scene.meshes[0]?.textureCoords[0]?.[0]?.y).toBe(1);
  });

  it("sorts by primitive type", () => {
    const scene = new SortByPTypeStep().process(baseScene);
    expect(scene.meshes.length).toBeGreaterThan(1);
  });

  it("merges meshes with same material", () => {
    const scene = new OptimizeMeshesStep().process(baseScene);
    expect(scene.meshes).toHaveLength(1);
  });
});

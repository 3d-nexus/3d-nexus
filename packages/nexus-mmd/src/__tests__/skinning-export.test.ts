import { describe, expect, it } from "vitest";
import { createIdentityMatrix4x4, type AiScene } from "nexus-core";
import { MMDImporter } from "../MMDImporter";
import { MMDPmxExporter } from "../MMDPmxExporter";

const scene: AiScene = {
  flags: 0 as never,
  rootNode: {
    name: "Root",
    transformation: createIdentityMatrix4x4(),
    parent: null,
    children: [
      { name: "Bone0", transformation: createIdentityMatrix4x4(), parent: null, children: [], meshIndices: [], metadata: null },
      { name: "Bone1", transformation: createIdentityMatrix4x4(), parent: null, children: [], meshIndices: [], metadata: null },
      { name: "Bone2", transformation: createIdentityMatrix4x4(), parent: null, children: [], meshIndices: [], metadata: null },
      { name: "Bone3", transformation: createIdentityMatrix4x4(), parent: null, children: [], meshIndices: [], metadata: null },
    ],
    meshIndices: [0],
    metadata: null,
  },
  meshes: [
    {
      name: "Mesh",
      primitiveTypes: 4 as never,
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      normals: [
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      tangents: [],
      bitangents: [],
      textureCoords: [[{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], null, null, null, null, null, null, null],
      colors: Array.from({ length: 8 }, () => null),
      faces: [{ indices: [0, 1, 2] }],
      bones: [
        {
          name: "Bone0",
          weights: [{ vertexId: 0, weight: 0.7 }, { vertexId: 1, weight: 0.25 }, { vertexId: 2, weight: 0.4 }],
          offsetMatrix: createIdentityMatrix4x4(),
          ikChain: { type: "sdef", c: { x: 1, y: 2, z: 3 }, r0: { x: 4, y: 5, z: 6 }, r1: { x: 7, y: 8, z: 9 } },
        },
        {
          name: "Bone1",
          weights: [{ vertexId: 0, weight: 0.3 }, { vertexId: 1, weight: 0.25 }, { vertexId: 2, weight: 0.3 }],
          offsetMatrix: createIdentityMatrix4x4(),
        },
        {
          name: "Bone2",
          weights: [{ vertexId: 1, weight: 0.25 }, { vertexId: 2, weight: 0.2 }],
          offsetMatrix: createIdentityMatrix4x4(),
        },
        {
          name: "Bone3",
          weights: [{ vertexId: 1, weight: 0.25 }, { vertexId: 2, weight: 0.1 }],
          offsetMatrix: createIdentityMatrix4x4(),
        },
      ],
      materialIndex: 0,
      morphTargets: [],
      aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
    },
  ],
  materials: [{ name: "Material", properties: [] }],
  animations: [],
  textures: [],
  lights: [],
  cameras: [],
  metadata: {},
};

scene.rootNode.children.forEach((child) => {
  child.parent = scene.rootNode;
});

describe("PMX skinning export", () => {
  it("roundtrips BDEF2, BDEF4 and SDEF style weights", () => {
    const exporter = new MMDPmxExporter();
    const importer = new MMDImporter();

    const buffer = exporter.write(scene);
    const result = importer.read(buffer, "synthetic.pmx");
    const bones = result.scene.meshes[0]!.bones;

    expect(bones[0]?.ikChain).toMatchObject({ type: "sdef" });
    expect(bones[0]?.weights.find((entry) => entry.vertexId === 0)?.weight).toBeCloseTo(0.7);
    expect(bones[1]?.weights.find((entry) => entry.vertexId === 0)?.weight).toBeCloseTo(0.3);
    expect(bones[0]?.weights.find((entry) => entry.vertexId === 1)?.weight).toBeCloseTo(0.25);
    expect(bones[3]?.weights.find((entry) => entry.vertexId === 1)?.weight).toBeCloseTo(0.25);
  });
});

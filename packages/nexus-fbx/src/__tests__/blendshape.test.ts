import { describe, expect, it } from "vitest";
import { createIdentityMatrix4x4, type AiScene } from "nexus-core";
import { FBXExporter } from "../FBXExporter";
import { FBXImporter } from "../FBXImporter";

function createScene(): AiScene {
  const baseVertices = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ];
  return {
    flags: 0 as never,
    rootNode: {
      name: "Root",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [],
      meshIndices: [0],
      metadata: null,
    },
    meshes: [
      {
        name: "MorphMesh",
        primitiveTypes: 4 as never,
        vertices: baseVertices,
        normals: [
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
        tangents: [],
        bitangents: [],
        textureCoords: [[{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }], null, null, null, null, null, null, null],
        colors: Array.from({ length: 8 }, () => null),
        faces: [{ indices: [0, 1, 2] }],
        bones: [],
        materialIndex: 0,
        morphTargets: [
          {
            name: "Smile",
            vertices: baseVertices.map((vertex, index) => (index === 0 ? { x: vertex.x + 0.5, y: vertex.y, z: vertex.z } : { ...vertex })),
            normals: [
              { x: 0, y: 1, z: 0 },
              { x: 0, y: 1, z: 0 },
              { x: 0, y: 1, z: 0 },
            ],
            tangents: [],
            bitangents: [],
            colors: Array.from({ length: 8 }, () => null),
            textureCoords: [[{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }], null, null, null, null, null, null, null],
            weight: 0,
          },
          {
            name: "Blink",
            vertices: baseVertices.map((vertex, index) => (index === 1 ? { x: vertex.x, y: vertex.y + 0.25, z: vertex.z } : { ...vertex })),
            normals: [
              { x: 0, y: 1, z: 0 },
              { x: 0, y: 1, z: 0 },
              { x: 0, y: 1, z: 0 },
            ],
            tangents: [],
            bitangents: [],
            colors: Array.from({ length: 8 }, () => null),
            textureCoords: [[{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }], null, null, null, null, null, null, null],
            weight: 0,
          },
        ],
        aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 1.5, y: 1.25, z: 0 } },
      },
    ],
    materials: [{ name: "Mat", properties: [] }],
    animations: [],
    textures: [],
    lights: [],
    cameras: [],
    metadata: {},
  };
}

describe("FBX blendshapes", () => {
  it("imports exported blendshapes as dense morph targets", () => {
    const buffer = new FBXExporter().write(createScene());
    const scene = new FBXImporter().read(buffer, "blendshape.fbx").scene;

    expect(scene.meshes[0]?.morphTargets.length).toBe(2);
    expect(scene.meshes[0]?.morphTargets[0]?.vertices.length).toBe(scene.meshes[0]?.vertices.length);
  });
});

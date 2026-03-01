import { describe, expect, it } from "vitest";
import { AiAnimBehaviour, createIdentityMatrix4x4, type AiScene } from "nexus-core";
import { FBXExporter } from "../FBXExporter";
import { FBXImporter } from "../FBXImporter";

function createScene(): AiScene {
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
        name: "AnimatedMesh",
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
        textureCoords: [[{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }], null, null, null, null, null, null, null],
        colors: Array.from({ length: 8 }, () => null),
        faces: [{ indices: [0, 1, 2] }],
        bones: [],
        materialIndex: 0,
        morphTargets: [],
        aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
      },
    ],
    materials: [{ name: "Mat", properties: [] }],
    animations: [
      {
        name: "Take001",
        duration: 1.5,
        ticksPerSecond: 1,
        channels: [
          {
            nodeName: "AnimatedMesh",
            positionKeys: [
              { time: 0, value: { x: 0, y: 0, z: 0 } },
              { time: 1.5, value: { x: 3, y: 0, z: 0 } },
            ],
            rotationKeys: [{ time: 0, value: { x: 0, y: 0, z: 0, w: 1 } }],
            scalingKeys: [{ time: 0, value: { x: 1, y: 1, z: 1 } }],
            preState: AiAnimBehaviour.DEFAULT,
            postState: AiAnimBehaviour.DEFAULT,
          },
        ],
        meshChannels: [],
        morphMeshChannels: [],
      },
    ],
    textures: [],
    lights: [],
    cameras: [],
    metadata: {},
  };
}

describe("FBX animation", () => {
  it("imports exported animation curves", () => {
    const buffer = new FBXExporter().write(createScene());
    const scene = new FBXImporter().read(buffer, "animated.fbx").scene;

    expect(scene.animations.length).toBe(1);
    expect(scene.animations[0]?.channels.length).toBeGreaterThan(0);
    expect(scene.animations[0]?.channels[0]?.positionKeys[1]?.time).toBeCloseTo(1.5, 5);
  });
});

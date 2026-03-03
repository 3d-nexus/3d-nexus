import { describe, expect, it } from "vitest";
import { createIdentityMatrix4x4, type AiNode, type AiScene } from "@3d-nexus/core";
import { MMDImporter } from "../MMDImporter";
import { MMDPmxExporter } from "../MMDPmxExporter";

function readCount(scene: AiScene, key: string): number {
  const raw = scene.metadata[key]?.data;
  if (typeof raw !== "string") {
    return 0;
  }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.length : 0;
}

function createBoneNode(name: string): AiNode {
  return {
    name,
    transformation: createIdentityMatrix4x4(),
    parent: null,
    children: [],
    meshIndices: [],
    metadata: null,
  };
}

function createPhysicsScene(): AiScene {
  const children = Array.from({ length: 5 }, (_, index) => createBoneNode(`Bone${index}`));
  const rootNode: AiNode = {
    name: "PhysicsRoot",
    transformation: createIdentityMatrix4x4(),
    parent: null,
    children,
    meshIndices: [0],
    metadata: null,
  };
  children.forEach((child) => {
    child.parent = rootNode;
  });

  return {
    flags: 0 as never,
    rootNode,
    meshes: [
      {
        name: "PhysicsMesh",
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
        bones: [],
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
    metadata: {
      "mmd:rigidBodies": {
        type: 5 as never,
        data: JSON.stringify(
          Array.from({ length: 5 }, (_, index) => ({
            name: `Rigid${index}`,
            englishName: `Rigid${index}`,
            boneIndex: index,
            groupIndex: index,
            nonCollisionMask: 0,
            shape: index % 3,
            size: [1, 1, 1],
            position: [index, 0, 0],
            rotation: [0, 0, 0],
            mass: 1,
            translateDamping: 0.5,
            rotateDamping: 0.25,
            repulsion: 0.1,
            friction: 0.2,
            physicsMode: 0,
          })),
        ),
      },
      "mmd:joints": {
        type: 5 as never,
        data: JSON.stringify(
          Array.from({ length: 4 }, (_, index) => ({
            name: `Joint${index}`,
            englishName: `Joint${index}`,
            type: 0,
            rigidBodyA: index,
            rigidBodyB: index + 1,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            limitPositionMin: [-1, -1, -1],
            limitPositionMax: [1, 1, 1],
            limitRotationMin: [-0.5, -0.5, -0.5],
            limitRotationMax: [0.5, 0.5, 0.5],
            springPosition: [0, 0, 0],
            springRotation: [0, 0, 0],
          })),
        ),
      },
    },
  };
}

describe("PMX physics export", () => {
  it("roundtrips rigid body and joint counts", () => {
    const exporter = new MMDPmxExporter();
    const importer = new MMDImporter();

    const buffer = exporter.write(createPhysicsScene());
    const result = importer.read(buffer, "physics.pmx");

    expect(readCount(result.scene, "mmd:rigidBodies")).toBe(5);
    expect(readCount(result.scene, "mmd:joints")).toBe(4);
  });
});


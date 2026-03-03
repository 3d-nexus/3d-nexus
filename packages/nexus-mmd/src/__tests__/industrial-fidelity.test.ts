import { describe, expect, it } from "vitest";
import { AiMetadataType, AiPrimitiveType, createIdentityMatrix4x4, type AiScene } from "@3d-nexus/core";
import { MMDImporter } from "../MMDImporter";
import { MMDPmxExporter } from "../MMDPmxExporter";
import { MMDPmxParser } from "../MMDPmxParser";

function createIndustrialScene(): AiScene {
  return {
    flags: 0 as never,
    rootNode: {
      name: "Industrial",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [],
      meshIndices: [0],
      metadata: null,
    },
    meshes: [
      {
        name: "Mesh",
        primitiveTypes: AiPrimitiveType.TRIANGLE,
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
        textureCoords: [
          [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
          null,
          null,
          [{ x: 0.2, y: 0.4, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
          null,
          null,
          null,
          null,
        ],
        colors: Array.from({ length: 8 }, () => null),
        faces: [{ indices: [0, 1, 2] }],
        bones: [
          { name: "Bone0", weights: [{ vertexId: 0, weight: 0.4 }], offsetMatrix: createIdentityMatrix4x4() },
          { name: "Bone1", weights: [{ vertexId: 0, weight: 0.3 }], offsetMatrix: createIdentityMatrix4x4() },
          { name: "Bone2", weights: [{ vertexId: 0, weight: 0.2 }], offsetMatrix: createIdentityMatrix4x4() },
          { name: "Bone3", weights: [{ vertexId: 0, weight: 0.1 }], offsetMatrix: createIdentityMatrix4x4() },
        ],
        materialIndex: 0,
        morphTargets: [
          {
            name: "UV3:SparkleEN",
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
            colors: Array.from({ length: 8 }, () => null),
            textureCoords: [
              null,
              null,
              null,
              [{ x: 0.2, y: 0.4, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
              null,
              null,
              null,
              null,
            ],
            weight: 0,
          },
        ],
        aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
      },
    ],
    materials: [{ name: "Material", properties: [] }],
    animations: [],
    textures: [],
    lights: [],
    cameras: [],
    metadata: {
      "mmd:vertexSkinning": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([
          {
            meshIndex: 0,
            vertexIndex: 0,
            skinningType: 4,
            skinning: {
              bones: [
                { boneIndex: 0, weight: 0.4 },
                { boneIndex: 1, weight: 0.3 },
                { boneIndex: 2, weight: 0.2 },
                { boneIndex: 3, weight: 0.1 },
              ],
            },
          },
        ]),
      },
      "mmd:morphCatalog": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([
          { name: "Sparkle", englishName: "SparkleEN", panel: 2, type: 6, order: 0, offsets: [{ vertexIndex: 0, channel: 3, uv: [0.2, 0.4, 0, 0] }] },
          { name: "Flip", englishName: "FlipEN", panel: 3, type: 9, order: 1, offsets: [{ morphIndex: 0, weight: 0.75 }] },
          {
            name: "Impulse",
            englishName: "ImpulseEN",
            panel: 4,
            type: 10,
            order: 2,
            offsets: [{ rigidBodyIndex: 0, localFlag: 1, velocity: [1, 2, 3], torque: [4, 5, 6] }],
          },
        ]),
      },
      "mmd:flipMorphs": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([{ name: "Flip", englishName: "FlipEN", panel: 3, entries: [{ morphIndex: 0, weight: 0.75 }] }]),
      },
      "mmd:impulseMorphs": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([
          { name: "Impulse", englishName: "ImpulseEN", panel: 4, entries: [{ rigidBodyIndex: 0, localFlag: 1, velocity: [1, 2, 3], torque: [4, 5, 6] }] },
        ]),
      },
      "mmd:softBodies": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([
          {
            name: "Soft",
            englishName: "SoftEN",
            shape: 1,
            materialIndex: 0,
            groupIndex: 2,
            nonCollisionMask: 7,
            flags: 3,
            blinkDistance: 0.5,
            clusterCount: 8,
            totalMass: 9.5,
            collisionMargin: 0.01,
            aeroModel: 2,
          },
        ]),
      },
      "mmd:rigidBodies": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([
          {
            name: "Rigid",
            englishName: "Rigid",
            boneIndex: 0,
            groupIndex: 1,
            nonCollisionMask: 3,
            shape: 0,
            size: [1, 1, 1],
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            mass: 1,
            translateDamping: 0.1,
            rotateDamping: 0.2,
            repulsion: 0.3,
            friction: 0.4,
            physicsMode: 1,
          },
        ]),
      },
      "mmd:joints": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([
          {
            name: "Joint",
            englishName: "Joint",
            type: 0,
            rigidBodyA: 0,
            rigidBodyB: 0,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            limitPositionMin: [-1, -1, -1],
            limitPositionMax: [1, 1, 1],
            limitRotationMin: [-0.5, -0.5, -0.5],
            limitRotationMax: [0.5, 0.5, 0.5],
            springPosition: [0.1, 0.2, 0.3],
            springRotation: [0.4, 0.5, 0.6],
          },
        ]),
      },
    },
  };
}

describe("PMX industrial fidelity", () => {
  it("preserves authored QDEF, extended UV morphs, flip/impulse morphs, and soft-body fields", () => {
    const exporter = new MMDPmxExporter();
    const importer = new MMDImporter();
    const parser = new MMDPmxParser();

    const buffer = exporter.write(createIndustrialScene());
    const document = parser.parse(buffer);
    const scene = importer.read(buffer, "industrial.pmx").scene;
    const morphCatalog = JSON.parse(String(scene.metadata["mmd:morphCatalog"]?.data ?? "[]"));
    const impulseMorphs = JSON.parse(String(scene.metadata["mmd:impulseMorphs"]?.data ?? "[]"));
    const softBodies = JSON.parse(String(scene.metadata["mmd:softBodies"]?.data ?? "[]"));

    expect(document.vertices[0]?.skinningType).toBe(4);
    expect(document.morphs.map((entry) => entry.type)).toEqual([6, 9, 10]);
    expect(scene.meshes[0]?.morphTargets[0]?.name).toBe("UV3:SparkleEN");
    expect(morphCatalog[0]?.englishName).toBe("SparkleEN");
    expect(impulseMorphs[0]?.entries?.[0]?.velocity?.[1]).toBe(2);
    expect(softBodies[0]?.clusterCount).toBe(8);
    expect(softBodies[0]?.aeroModel).toBe(2);
  });
});


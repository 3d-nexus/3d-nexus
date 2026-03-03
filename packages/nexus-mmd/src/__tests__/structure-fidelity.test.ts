import { describe, expect, it } from "vitest";
import { AiMetadataType, AiPropertyTypeInfo, AiTextureType, AiPrimitiveType, createIdentityMatrix4x4, type AiScene } from "@3d-nexus/core";
import { MMDExporter } from "../MMDExporter";
import { MMDImporter } from "../MMDImporter";

function createScene(): AiScene {
  return {
    flags: 0 as never,
    rootNode: {
      name: "Model",
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
        textureCoords: [[{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }], null, null, null, null, null, null, null],
        colors: Array.from({ length: 8 }, () => null),
        faces: [{ indices: [0, 1, 2] }],
        bones: [],
        materialIndex: 0,
        morphTargets: [],
        aabb: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
      },
    ],
    materials: [
      {
        name: "Mat",
        properties: [
          { key: "$clr.diffuse", semantic: AiTextureType.DIFFUSE, index: 0, type: AiPropertyTypeInfo.FLOAT, data: { r: 1, g: 1, b: 1, a: 1 } },
          { key: "mmd:edgeColor", semantic: AiTextureType.NONE, index: 0, type: AiPropertyTypeInfo.FLOAT, data: { r: 0, g: 0, b: 0, a: 1 } },
          { key: "mmd:edgeSize", semantic: AiTextureType.NONE, index: 0, type: AiPropertyTypeInfo.FLOAT, data: 0.5 },
          { key: "mmd:sphereMode", semantic: AiTextureType.NONE, index: 0, type: AiPropertyTypeInfo.INTEGER, data: 2 },
          { key: "mmd:toonIndex", semantic: AiTextureType.NONE, index: 0, type: AiPropertyTypeInfo.INTEGER, data: 3 },
        ],
        metadata: {
          englishName: "MatEN",
          flags: 1,
          sphereTextureIndex: -1,
          toonSharingFlag: 1,
          memo: "memo",
        },
      },
    ],
    animations: [],
    textures: [],
    lights: [],
    cameras: [],
    metadata: {
      "mmd:boneStructures": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([
          {
            name: "BoneA",
            englishName: "BoneA_EN",
            position: [0, 0, 0],
            parentIndex: -1,
            layer: 1,
            flags: 0x0100 | 0x0400 | 0x0800 | 0x2000,
            tailOffset: [0, 1, 0],
            inheritBoneIndex: -1,
            inheritWeight: 0.5,
            fixedAxis: [0, 1, 0],
            localAxisX: [1, 0, 0],
            localAxisZ: [0, 0, 1],
            externalParentKey: 42,
          },
        ]),
      },
      "mmd:displayFrames": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([{ name: "Face", englishName: "FaceEN", specialFlag: 1, elements: [{ type: 0, index: 0 }] }]),
      },
      "mmd:softBodies": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([{ name: "Soft", englishName: "SoftEN" }]),
      },
    },
  };
}

describe("PMX structure fidelity", () => {
  it("preserves bone structure metadata, display frames, soft bodies, and material extension fields", () => {
    const importer = new MMDImporter();
    const exporter = new MMDExporter();
    const scene = importer.read(exporter.write(createScene(), { format: "pmx" }), "structure.pmx").scene;
    const bones = JSON.parse(String(scene.metadata["mmd:boneStructures"]?.data ?? "[]"));
    const displayFrames = JSON.parse(String(scene.metadata["mmd:displayFrames"]?.data ?? "[]"));
    const softBodies = JSON.parse(String(scene.metadata["mmd:softBodies"]?.data ?? "[]"));
    const material = scene.materials[0]!;

    expect(bones[0]?.externalParentKey).toBe(42);
    expect(bones[0]?.localAxisX?.[0]).toBe(1);
    expect(displayFrames[0]?.name).toBe("Face");
    expect(softBodies[0]?.name).toBe("Soft");
    expect(material.metadata?.toonSharingFlag).toBe(1);
    expect(material.properties.find((entry) => entry.key === "mmd:sphereMode")?.data).toBe(2);
  });
});


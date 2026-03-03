import { describe, expect, it } from "vitest";
import { AiPropertyTypeInfo, AiTextureType, createIdentityMatrix4x4, type AiScene } from "@3d-nexus/core";
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
        name: "TexturedMesh",
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
        textureCoords: [
          [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }],
          [{ x: 0.1, y: 0.1, z: 0 }, { x: 0.9, y: 0.1, z: 0 }, { x: 0.1, y: 0.9, z: 0 }],
          null,
          null,
          null,
          null,
          null,
          null,
        ],
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
          { key: "$clr.diffuse", semantic: AiTextureType.DIFFUSE, index: 0, type: AiPropertyTypeInfo.FLOAT, data: { r: 0.4, g: 0.5, b: 0.6, a: 1 } },
          { key: "$clr.specular", semantic: AiTextureType.SPECULAR, index: 0, type: AiPropertyTypeInfo.FLOAT, data: { r: 0.2, g: 0.3, b: 0.4, a: 1 } },
          { key: "$clr.ambient", semantic: AiTextureType.AMBIENT, index: 0, type: AiPropertyTypeInfo.FLOAT, data: { r: 0.1, g: 0.1, b: 0.1, a: 1 } },
          { key: "$tex.file", semantic: AiTextureType.DIFFUSE, index: 0, type: AiPropertyTypeInfo.STRING, data: "*0" },
          { key: "$tex.file", semantic: AiTextureType.NORMALS, index: 0, type: AiPropertyTypeInfo.STRING, data: "normal.png" },
        ],
      },
    ],
    animations: [],
    textures: [
      {
        filename: "diffuse.png",
        width: 1,
        height: 1,
        formatHint: "png",
        data: new Uint8Array([1, 2, 3, 4]),
      },
    ],
    lights: [],
    cameras: [],
    metadata: {},
  };
}

describe("FBX material and texture pipeline", () => {
  it("roundtrips material colors, texture semantics, embedded video refs, and multi-uv layers", () => {
    const buffer = new FBXExporter().write(createScene());
    const scene = new FBXImporter().read(buffer, "textured.fbx").scene;
    const material = scene.materials[0]!;

    expect(scene.meshes[0]?.textureCoords[1]?.length).toBe(3);
    expect(scene.textures.length).toBeGreaterThan(0);
    expect(material.properties.some((property) => property.key === "$clr.diffuse")).toBe(true);
    expect(
      material.properties.some(
        (property) => property.key === "$tex.file" && property.semantic === AiTextureType.NORMALS,
      ),
    ).toBe(true);
  });
});


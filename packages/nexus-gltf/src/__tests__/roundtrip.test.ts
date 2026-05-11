import { AiPrimitiveType, AiPropertyTypeInfo, AiSceneFlags, AiTextureType, createIdentityMatrix4x4, type AiScene } from "@3d-nexus/core";
import { describe, expect, it } from "vitest";
import { GltfExporter } from "../GltfExporter";
import { GltfImporter } from "../GltfImporter";
import { isGlb } from "../glb";

function createScene(): AiScene {
  return {
    flags: AiSceneFlags.AI_SCENE_FLAGS_VALIDATED,
    rootNode: {
      name: "Root",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      meshIndices: [0],
      children: [],
      metadata: null,
    },
    meshes: [
      {
        name: "Triangle",
        primitiveTypes: AiPrimitiveType.TRIANGLE,
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
        ],
        normals: [
          { x: 0, y: 0, z: 1 },
          { x: 0, y: 0, z: 1 },
          { x: 0, y: 0, z: 1 },
        ],
        tangents: [],
        bitangents: [],
        textureCoords: [
          [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
          ],
          null,
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
        name: "Red",
        properties: [
          {
            key: "$clr.diffuse",
            semantic: AiTextureType.DIFFUSE,
            index: 0,
            type: AiPropertyTypeInfo.FLOAT,
            data: { r: 1, g: 0, b: 0, a: 1 },
          },
        ],
      },
    ],
    animations: [],
    textures: [],
    lights: [],
    cameras: [],
    metadata: {},
  };
}

describe("GltfExporter/GltfImporter", () => {
  it("roundtrips GLB mesh data", () => {
    const exporter = new GltfExporter();
    const output = exporter.write(createScene(), { format: "glb" });

    expect(isGlb(output)).toBe(true);
    const scene = new GltfImporter().read(output, "scene.glb").scene;

    expect(scene.meshes).toHaveLength(1);
    expect(scene.meshes[0]?.vertices).toHaveLength(3);
    expect(scene.meshes[0]?.faces[0]?.indices).toEqual([0, 1, 2]);
    expect(scene.materials[0]?.name).toBe("Red");
  });

  it("roundtrips glTF JSON with an external BIN buffer", () => {
    const exporter = new GltfExporter();
    const json = exporter.write(createScene(), { format: "gltf", binFileName: "triangle.bin" });
    const bin = exporter.getBinContent();

    expect(new TextDecoder().decode(json)).toContain('"uri": "triangle.bin"');
    const scene = new GltfImporter().read(json, "scene.gltf", { binBuffer: bin }).scene;

    expect(scene.meshes[0]?.vertices[1]).toEqual({ x: 1, y: 0, z: 0 });
    expect(scene.meshes[0]?.textureCoords[0]?.[2]).toEqual({ x: 0, y: 1, z: 0 });
  });
});

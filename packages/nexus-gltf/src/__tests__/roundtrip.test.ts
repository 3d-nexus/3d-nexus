import { AiAnimBehaviour, AiPrimitiveType, AiPropertyTypeInfo, AiSceneFlags, AiTextureType, createIdentityMatrix4x4, type AiScene } from "@3d-nexus/core";
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
      meshIndices: [],
      children: [
        {
          name: "BoneA",
          transformation: createIdentityMatrix4x4(),
          parent: null,
          meshIndices: [],
          children: [
            {
              name: "BoneB",
              transformation: createIdentityMatrix4x4(),
              parent: null,
              meshIndices: [],
              children: [],
              metadata: null,
            },
          ],
          metadata: null,
        },
        {
          name: "TriangleNode",
          transformation: createIdentityMatrix4x4(),
          parent: null,
          meshIndices: [0],
          children: [],
          metadata: null,
        },
      ],
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
        bones: [
          {
            name: "BoneA",
            weights: [
              { vertexId: 0, weight: 1 },
              { vertexId: 1, weight: 0.5 },
            ],
            offsetMatrix: createIdentityMatrix4x4(),
          },
          {
            name: "BoneB",
            weights: [
              { vertexId: 1, weight: 0.5 },
              { vertexId: 2, weight: 1 },
            ],
            offsetMatrix: createIdentityMatrix4x4(),
          },
        ],
        materialIndex: 0,
        morphTargets: [
          {
            name: "RaiseTip",
            vertices: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
              { x: 0, y: 1.5, z: 0 },
            ],
            normals: [
              { x: 0, y: 0, z: 1 },
              { x: 0, y: 0, z: 1 },
              { x: 0, y: 0.1, z: 1 },
            ],
            tangents: [],
            bitangents: [],
            colors: Array.from({ length: 8 }, () => null),
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
            weight: 0.75,
          },
        ],
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
          { key: "$mat.metalness", semantic: AiTextureType.NONE, index: 0, type: AiPropertyTypeInfo.FLOAT, data: 0.25 },
          { key: "$mat.roughness", semantic: AiTextureType.NONE, index: 0, type: AiPropertyTypeInfo.FLOAT, data: 0.75 },
          { key: "$tex.file", semantic: AiTextureType.DIFFUSE, index: 0, type: AiPropertyTypeInfo.STRING, data: "*0" },
          { key: "$tex.file", semantic: AiTextureType.NORMALS, index: 0, type: AiPropertyTypeInfo.STRING, data: "normal.png" },
        ],
      },
    ],
    animations: [
      {
        name: "Move",
        duration: 1,
        ticksPerSecond: 1,
        channels: [
          {
            nodeName: "TriangleNode",
            positionKeys: [
              { time: 0, value: { x: 0, y: 0, z: 0 } },
              { time: 1, value: { x: 2, y: 0, z: 0 } },
            ],
            rotationKeys: [
              { time: 0, value: { x: 0, y: 0, z: 0, w: 1 } },
              { time: 1, value: { x: 0, y: 0, z: 0.70710678, w: 0.70710678 } },
            ],
            scalingKeys: [{ time: 0, value: { x: 1, y: 1, z: 1 } }],
            preState: AiAnimBehaviour.DEFAULT,
            postState: AiAnimBehaviour.DEFAULT,
          },
        ],
        meshChannels: [],
        morphMeshChannels: [
          {
            name: "RaiseTip",
            keys: [
              { time: 0, values: [0], weights: [0.25] },
              { time: 1, values: [0], weights: [1] },
            ],
          },
        ],
      },
    ],
    textures: [{ filename: "albedo.png", width: 0, height: 0, formatHint: "png", data: new Uint8Array([1, 2, 3, 4]) }],
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
    expect(scene.textures[0]?.data).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(scene.materials[0]?.properties.some((property) => property.key === "$tex.file" && property.semantic === AiTextureType.DIFFUSE)).toBe(true);
    expect(scene.animations[0]?.channels[0]?.positionKeys[1]?.value).toEqual({ x: 2, y: 0, z: 0 });
    expect(scene.animations[0]?.channels[0]?.rotationKeys[1]?.value.z).toBeCloseTo(0.70710678, 5);
    expect(scene.meshes[0]?.bones.map((bone) => bone.name)).toEqual(["BoneA", "BoneB"]);
    expect(scene.meshes[0]?.bones[0]?.weights).toContainEqual({ vertexId: 0, weight: 1 });
    expect(scene.meshes[0]?.bones[1]?.node?.name).toBe("BoneB");
    expect(scene.meshes[0]?.morphTargets[0]?.name).toBe("RaiseTip");
    expect(scene.meshes[0]?.morphTargets[0]?.vertices[2]?.y).toBeCloseTo(1.5, 5);
    expect(scene.meshes[0]?.morphTargets[0]?.weight).toBeCloseTo(0.75, 5);
    expect(scene.animations[0]?.morphMeshChannels[0]?.name).toBe("RaiseTip");
    expect(scene.animations[0]?.morphMeshChannels[0]?.keys[1]?.weights[0]).toBeCloseTo(1, 5);
  });

  it("roundtrips glTF JSON with an external BIN buffer", () => {
    const exporter = new GltfExporter();
    const json = exporter.write(createScene(), { format: "gltf", binFileName: "triangle.bin" });
    const bin = exporter.getBinContent();

    expect(new TextDecoder().decode(json)).toContain('"uri": "triangle.bin"');
    expect(new TextDecoder().decode(json)).toContain('"skins"');
    expect(new TextDecoder().decode(json)).toContain('"targets"');
    expect(new TextDecoder().decode(json)).toContain('"targetNames"');
    expect(new TextDecoder().decode(json)).toContain('"path": "weights"');
    const scene = new GltfImporter().read(json, "scene.gltf", { binBuffer: bin }).scene;

    expect(scene.meshes[0]?.vertices[1]).toEqual({ x: 1, y: 0, z: 0 });
    expect(scene.meshes[0]?.textureCoords[0]?.[2]).toEqual({ x: 0, y: 1, z: 0 });
    expect(scene.animations[0]?.channels[0]?.nodeName).toBe("TriangleNode");
    expect(scene.meshes[0]?.morphTargets[0]?.vertices[2]?.y).toBeCloseTo(1.5, 5);
    expect(scene.animations[0]?.morphMeshChannels[0]?.keys[0]?.weights[0]).toBeCloseTo(0.25, 5);
  });

  it("imports node TRS rotation", () => {
    const json = new TextEncoder().encode(
      JSON.stringify({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "Rotated", rotation: [0, 0, 0.70710678, 0.70710678] }],
      }),
    ).buffer;

    const node = new GltfImporter().read(json, "scene.gltf").scene.rootNode.children[0];

    expect(node?.transformation.data[0]).toBeCloseTo(0, 5);
    expect(node?.transformation.data[1]).toBeCloseTo(1, 5);
  });
});

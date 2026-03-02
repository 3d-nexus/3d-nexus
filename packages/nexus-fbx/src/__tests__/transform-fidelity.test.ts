import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AiMetadataType, AiPrimitiveType, createIdentityMatrix4x4, type AiScene } from "nexus-core";
import { FBXExporter } from "../FBXExporter";
import { FBXImporter } from "../FBXImporter";

function readFixture(name: string): ArrayBuffer {
  const file = readFileSync(join(import.meta.dirname, "../../fixtures", name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

function createInstancedScene(): AiScene {
  const transformStack = {
    translation: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 45, z: 0 },
    scaling: { x: -1, y: 1, z: 1 },
    rotationOrder: "ZYX",
    preRotation: { x: 0, y: 10, z: 0 },
    postRotation: { x: 0, y: 0, z: 0 },
    rotationPivot: { x: 0.5, y: 0, z: 0 },
    rotationOffset: { x: 0, y: 0, z: 0 },
    scalingPivot: { x: 0, y: 0, z: 0 },
    scalingOffset: { x: 0, y: 0, z: 0 },
    geometricTranslation: { x: 0, y: 0, z: 0 },
    geometricRotation: { x: 0, y: 0, z: 0 },
    geometricScaling: { x: 1, y: 1, z: 1 },
    inheritType: 1,
    sourceModelId: "instance-a",
  };

  return {
    flags: 0 as never,
    rootNode: {
      name: "Root",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [
        {
          name: "InstanceA",
          transformation: createIdentityMatrix4x4(),
          parent: null,
          children: [],
          meshIndices: [0],
          metadata: {
            "fbx:transformStack": {
              type: AiMetadataType.AISTRING,
              data: JSON.stringify(transformStack),
            },
          },
        },
        {
          name: "InstanceB",
          transformation: createIdentityMatrix4x4(),
          parent: null,
          children: [],
          meshIndices: [0],
          metadata: {
            "fbx:transformStack": {
              type: AiMetadataType.AISTRING,
              data: JSON.stringify({
                ...transformStack,
                translation: { x: -1, y: 0, z: 0 },
                sourceModelId: "instance-b",
              }),
            },
          },
        },
      ],
      meshIndices: [],
      metadata: null,
    },
    meshes: [
      {
        name: "SharedMesh",
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
    materials: [{ name: "Mat", properties: [] }],
    animations: [],
    textures: [],
    lights: [],
    cameras: [],
    metadata: {},
  };
}

describe("FBX transform fidelity", () => {
  it("imports authored transform stacks into node metadata", () => {
    const scene = new FBXImporter().read(readFixture("maya-pivot.fbx"), "maya-pivot.fbx").scene;
    const node = scene.rootNode.children[0];

    expect(node?.metadata?.["fbx:transformStack"]).toBeDefined();
    expect(node?.transformation.data[12]).not.toBe(0);
  });

  it("marks mirrored transforms and shared instances on import", () => {
    const importer = new FBXImporter();
    const mirrored = importer.read(readFixture("max-negative-scale.fbx"), "max-negative-scale.fbx").scene;
    const instanceText = [
      "; FBX 7.4.0 project file",
      "FBXHeaderExtension: {",
      "  FBXVersion: 7400",
      "}",
      "Objects: {",
      "  Geometry: 1, \"Geometry::Shared\", \"Mesh\" {",
      "    Vertices: 0,0,0,1,0,0,0,1,0",
      "    PolygonVertexIndex: 0,1,-3",
      "    Normals: 0,1,0,0,1,0,0,1,0",
      "  }",
      "  Model: 2, \"Model::InstanceA\", \"Model\" {",
      "  }",
      "  Model: 3, \"Model::InstanceB\", \"Model\" {",
      "  }",
      "}",
      "Connections: {",
      "  C: \"OO\", 1, 2",
      "  C: \"OO\", 1, 3",
      "}",
      "Takes: {",
      "}",
    ].join("\n");
    const instanced = importer.read(new TextEncoder().encode(instanceText).buffer, "instanced.fbx").scene;

    expect(mirrored.rootNode.children[0]?.metadata?.["fbx:mirrored"]?.data).toBe(true);
    expect(instanced.rootNode.children).toHaveLength(2);
    expect(instanced.rootNode.children[0]?.meshIndices[0]).toBe(0);
    expect(instanced.rootNode.children[1]?.meshIndices[0]).toBe(0);
    expect(instanced.rootNode.children[0]?.metadata?.["fbx:instanceOf"]).toBeDefined();
  });

  it("exports transform stack properties and keeps one shared geometry for instanced nodes", () => {
    const text = new TextDecoder().decode(new FBXExporter().write(createInstancedScene()));

    expect((text.match(/Geometry::SharedMesh/g) ?? []).length).toBe(1);
    expect(text).toContain("Model::InstanceA");
    expect(text).toContain("Model::InstanceB");
    expect(text).toContain('P: "RotationPivot", "Vector3D", "", "A", 0.5, 0, 0');
    expect(text).toContain('P: "Lcl Scaling", "Lcl Scaling", "", "A", -1, 1, 1');
  });
});

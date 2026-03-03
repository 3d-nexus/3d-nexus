import { describe, expect, it } from "vitest";
import { AiMetadataType, AiPrimitiveType, AiLightSourceType, createIdentityMatrix4x4, type AiScene } from "@3d-nexus/core";
import { FBXExporter } from "../FBXExporter";
import { FBXImporter } from "../FBXImporter";

function createScene(): AiScene {
  return {
    flags: 0 as never,
    rootNode: {
      name: "Root",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [
        {
          name: "MeshNode",
          transformation: createIdentityMatrix4x4(),
          parent: null,
          children: [],
          meshIndices: [0],
          metadata: {
            "fbx:userProperties": {
              type: AiMetadataType.AISTRING,
              data: JSON.stringify([
                { name: "UserLabel", type: "KString", value: "Hero" },
                { name: "ExportVisible", type: "bool", value: true },
              ]),
            },
          },
        },
      ],
      meshIndices: [],
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
    materials: [{ name: "Mat", properties: [] }],
    animations: [],
    textures: [],
    cameras: [
      {
        name: "RenderCam",
        position: { x: 0, y: 2, z: 5 },
        up: { x: 0, y: 1, z: 0 },
        lookAt: { x: 0, y: 0, z: 0 },
        horizontalFov: Math.PI / 3,
        clipPlaneNear: 0.1,
        clipPlaneFar: 500,
        aspect: 16 / 9,
      },
    ],
    lights: [
      {
        name: "KeyLight",
        type: AiLightSourceType.SPOT,
        position: { x: 1, y: 3, z: 2 },
        direction: { x: 0, y: -1, z: 0 },
        up: { x: 0, y: 1, z: 0 },
        diffuseColor: { r: 1, g: 0.9, b: 0.8 },
        specularColor: { r: 1, g: 0.9, b: 0.8 },
        ambientColor: { r: 0, g: 0, b: 0 },
        angleInnerCone: 20,
        angleOuterCone: 35,
      },
    ],
    metadata: {
      "fbx:constraints": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([
          {
            name: "Constraint::Aim",
            type: "ConstraintAim",
            sourceModels: ["MeshNode"],
            targetModels: ["RenderCam"],
          },
          {
            name: "Constraint::Unsupported",
            type: "ConstraintScale",
            sourceModels: ["MeshNode"],
            targetModels: ["KeyLight"],
          },
        ]),
      },
    },
  };
}

describe("FBX scene extras", () => {
  it("roundtrips cameras, lights, constraints, user properties, and diagnostics", () => {
    const scene = new FBXImporter().read(new FBXExporter().write(createScene()), "scene-extras.fbx").scene;
    const findNode = (name: string, node = scene.rootNode): typeof scene.rootNode | undefined => {
      if (node.name === name) {
        return node;
      }
      for (const child of node.children) {
        const match = findNode(name, child);
        if (match) {
          return match;
        }
      }
      return undefined;
    };
    const meshNode = findNode("MeshNode");

    expect(scene.cameras[0]?.name).toBe("RenderCam");
    expect(scene.lights[0]?.name).toBe("KeyLight");
    expect(meshNode?.metadata?.["fbx:userProperties"]).toBeDefined();
    expect(scene.metadata["fbx:constraints"]).toBeDefined();
    expect(scene.metadata["nexus:compatDiagnostics"]).toBeDefined();
  });
});


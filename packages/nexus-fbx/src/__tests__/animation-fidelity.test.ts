import { describe, expect, it } from "vitest";
import { AiAnimBehaviour, AiLightSourceType, AiMetadataType, AiPrimitiveType, createIdentityMatrix4x4, type AiScene } from "@3d-nexus/core";
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
          name: "AnimatedMesh",
          transformation: createIdentityMatrix4x4(),
          parent: null,
          children: [],
          meshIndices: [0],
          metadata: {
            "fbx:transformStack": {
              type: AiMetadataType.AISTRING,
              data: JSON.stringify({
                translation: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                scaling: { x: 1, y: 1, z: 1 },
                rotationOrder: "ZYX",
                preRotation: { x: 0, y: 0, z: 0 },
                postRotation: { x: 0, y: 0, z: 0 },
                rotationPivot: { x: 0, y: 0, z: 0 },
                rotationOffset: { x: 0, y: 0, z: 0 },
                scalingPivot: { x: 0, y: 0, z: 0 },
                scalingOffset: { x: 0, y: 0, z: 0 },
                geometricTranslation: { x: 0, y: 0, z: 0 },
                geometricRotation: { x: 0, y: 0, z: 0 },
                geometricScaling: { x: 1, y: 1, z: 1 },
                inheritType: 0,
                sourceModelId: "animated-mesh",
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
        name: "AnimatedMesh",
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
    animations: [
      {
        name: "Take001",
        duration: 1,
        ticksPerSecond: 1,
        channels: [
          {
            nodeName: "AnimatedMesh",
            positionKeys: [
              { time: 0, value: { x: 0, y: 0, z: 0 } },
              { time: 1, value: { x: 2, y: 0, z: 0 } },
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
        diffuseColor: { r: 1, g: 1, b: 1 },
        specularColor: { r: 1, g: 1, b: 1 },
        ambientColor: { r: 0, g: 0, b: 0 },
        angleInnerCone: 20,
        angleOuterCone: 35,
      },
    ],
    metadata: {
      "fbx:animationStacks": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([
          {
            name: "Take001",
            layers: [{ name: "BaseLayer" }, { name: "AdditiveLayer" }],
          },
        ]),
      },
      "fbx:cameraAnimationCurves": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([
          {
            animationName: "Take001",
            layerName: "BaseLayer",
            objectName: "RenderCam",
            propertyName: "FieldOfView",
            axes: { X: { times: [0, 1], values: [45, 60] } },
          },
        ]),
      },
      "fbx:lightAnimationCurves": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify([
          {
            animationName: "Take001",
            layerName: "AdditiveLayer",
            objectName: "KeyLight",
            propertyName: "Intensity",
            axes: { X: { times: [0, 1], values: [1, 2] } },
          },
        ]),
      },
    },
  };
}

describe("FBX animation fidelity", () => {
  it("preserves stack metadata, camera/light property curves, and layer merge diagnostics", () => {
    const scene = new FBXImporter().read(new FBXExporter().write(createScene()), "animation-fidelity.fbx").scene;
    const animationStacks = JSON.parse(String(scene.metadata["fbx:animationStacks"]?.data ?? "[]"));
    const cameraCurves = JSON.parse(String(scene.metadata["fbx:cameraAnimationCurves"]?.data ?? "[]"));
    const lightCurves = JSON.parse(String(scene.metadata["fbx:lightAnimationCurves"]?.data ?? "[]"));
    const diagnostics = JSON.parse(String(scene.metadata["nexus:compatDiagnostics"]?.data ?? "[]"));

    expect(animationStacks[0]?.layers).toHaveLength(2);
    expect(animationStacks[0]?.layers[0]?.curveNodes[0]?.rotationOrder).toBe("ZYX");
    expect(cameraCurves[0]?.objectName).toBe("RenderCam");
    expect(lightCurves[0]?.objectName).toBe("KeyLight");
    expect(diagnostics.some((entry: { code?: string }) => entry.code === "FBX_ANIMATION_LAYER_MERGED")).toBe(true);
  });
});


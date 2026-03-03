import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AiAnimBehaviour, AiMetadataType, AiSceneFlags, createIdentityMatrix4x4, type AiScene } from "@3d-nexus/core";
import { describe, expect, it } from "vitest";

import { BVHExporter } from "../BVHExporter";
import { BVHImporter } from "../BVHImporter";

function loadFixture(name: string): ArrayBuffer {
  const fixturesDir = resolve(fileURLToPath(new URL("../../fixtures", import.meta.url)));
  const file = readFileSync(resolve(fixturesDir, name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

function createCanonicalScene(): AiScene {
  return {
    flags: AiSceneFlags.AI_SCENE_FLAGS_INCOMPLETE,
    rootNode: {
      name: "SceneRoot",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [
        {
          name: "Hip",
          transformation: createIdentityMatrix4x4(),
          parent: null,
          children: [],
          meshIndices: [],
          metadata: null,
        },
      ],
      meshIndices: [],
      metadata: null,
    },
    meshes: [],
    materials: [],
    animations: [
      {
        name: "HipMotion",
        duration: 1,
        ticksPerSecond: 30,
        channels: [
          {
            nodeName: "Hip",
            positionKeys: [
              { time: 0, value: { x: 0, y: 0, z: 0 } },
              { time: 1, value: { x: 3, y: 4, z: 5 } },
            ],
            rotationKeys: [],
            scalingKeys: [],
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
    metadata: {
      "bvh:frameTime": {
        type: AiMetadataType.AISTRING,
        data: "0.0333333",
      },
      "bvh:frameCount": {
        type: AiMetadataType.AISTRING,
        data: "2",
      },
    },
  };
}

describe("BVHExporter", () => {
  it("round-trips imported BVH with equivalent hierarchy and motion metadata", () => {
    const importer = new BVHImporter();
    const exporter = new BVHExporter();
    const imported = importer.read(loadFixture("minimal.bvh"), "minimal.bvh").scene;
    const reimported = importer.read(exporter.write(imported), "roundtrip.bvh").scene;

    expect(reimported.rootNode.children[0]?.name).toBe("Hips");
    expect(reimported.rootNode.children[0]?.metadata?.["bvh:channels"]?.data).toBe(
      JSON.stringify(["Xposition", "Yposition", "Zposition", "Zrotation", "Xrotation", "Yrotation"]),
    );
    expect(reimported.rootNode.children[0]?.children[0]?.metadata?.["bvh:jointType"]?.data).toBe("EndSite");
    expect(reimported.metadata["bvh:frameTime"]?.data).toBe("0.0333333");
    expect(reimported.metadata["bvh:motionValues"]?.data).toBe(JSON.stringify([
      [0, 0, 0, 0, 0, 0],
      [1, 2, 3, 10, 20, 30],
    ]));
  });

  it("exports a canonical hierarchy when BVH metadata is absent", () => {
    const output = new TextDecoder().decode(new BVHExporter().write(createCanonicalScene()));

    expect(output).toContain("ROOT Hip");
    expect(output).toContain("CHANNELS 6 Xposition Yposition Zposition Xrotation Yrotation Zrotation");
    expect(output).toContain("Frames: 2");
    expect(output).toContain("Frame Time: 0.0333333");
    expect(output).toContain("3 4 5 0 0 0");
  });
});


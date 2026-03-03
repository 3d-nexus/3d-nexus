import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { BVHImporter } from "../BVHImporter";

function loadFixture(name: string): ArrayBuffer {
  const fixturesDir = resolve(fileURLToPath(new URL("../../fixtures", import.meta.url)));
  const file = readFileSync(resolve(fixturesDir, name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

describe("BVHImporter", () => {
  it("maps root motion, End Site metadata, and rotation order into IR", () => {
    const importer = new BVHImporter();
    const result = importer.read(loadFixture("minimal.bvh"), "minimal.bvh");

    const hierarchyRoot = result.scene.rootNode.children[0];
    const endSite = hierarchyRoot?.children[0];
    const animation = result.scene.animations[0];
    const channel = animation?.channels[0];

    expect(hierarchyRoot?.name).toBe("Hips");
    expect(hierarchyRoot?.metadata?.["bvh:channels"]?.data).toBe(JSON.stringify([
      "Xposition",
      "Yposition",
      "Zposition",
      "Zrotation",
      "Xrotation",
      "Yrotation",
    ]));
    expect(hierarchyRoot?.metadata?.["bvh:rotationOrder"]?.data).toBe("ZXY");
    expect(endSite?.metadata?.["bvh:jointType"]?.data).toBe("EndSite");
    expect(endSite?.metadata?.["bvh:offset"]?.data).toBe(JSON.stringify([0, 10, 0]));

    expect(channel?.positionKeys).toEqual([
      { time: 0, value: { x: 0, y: 0, z: 0 } },
      { time: 1, value: { x: 1, y: 2, z: 3 } },
    ]);
    expect(channel?.rotationKeys).toHaveLength(2);
    expect(channel?.rotationKeys[0]?.time).toBe(0);
    expect(channel?.rotationKeys[1]?.time).toBe(1);
    expect(channel?.rotationKeys[1]?.value.w).not.toBe(1);

    expect(result.scene.metadata["bvh:frameTime"]?.data).toBe("0.0333333");
    expect(result.scene.metadata["bvh:frameIndices"]?.data).toBe(JSON.stringify([0, 1]));
    expect(result.scene.metadata["bvh:jointChannelLayout"]?.data).toContain("\"rotationOrder\":\"ZXY\"");
  });

  it("keeps original frame semantics in animation timing", () => {
    const importer = new BVHImporter();
    const result = importer.read(loadFixture("minimal.bvh"), "minimal.bvh");
    const animation = result.scene.animations[0];

    expect(animation?.duration).toBe(1);
    expect(animation?.ticksPerSecond).toBeCloseTo(30.00003, 4);
    expect(animation?.channels[0]?.positionKeys.map((key) => key.time)).toEqual([0, 1]);
    expect(animation?.channels[0]?.rotationKeys.map((key) => key.time)).toEqual([0, 1]);
  });
});

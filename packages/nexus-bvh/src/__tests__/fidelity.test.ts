import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BVHExporter } from "../BVHExporter";
import { BVHImporter } from "../BVHImporter";
import { analyzeBvhFrameDrift } from "../fidelity";

function loadFixture(name: string): ArrayBuffer {
  const fixturesDir = resolve(fileURLToPath(new URL("../../fixtures", import.meta.url)));
  const file = readFileSync(resolve(fixturesDir, name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

describe("BVH animation fidelity", () => {
  it("preserves frame time, frame count, root translation, and Euler order through roundtrip", () => {
    const importer = new BVHImporter();
    const exporter = new BVHExporter();
    const imported = importer.read(loadFixture("minimal.bvh"), "minimal.bvh").scene;
    const roundtripped = importer.read(exporter.write(imported), "roundtrip.bvh").scene;

    expect(roundtripped.metadata["bvh:frameTime"]?.data).toBe("0.0333333");
    expect(roundtripped.metadata["bvh:frameCount"]?.data).toBe("2");
    expect(roundtripped.metadata["bvh:motionValues"]?.data).toBe(JSON.stringify([
      [0, 0, 0, 0, 0, 0],
      [1, 2, 3, 10, 20, 30],
    ]));
    expect(roundtripped.rootNode.children[0]?.metadata?.["bvh:rotationOrder"]?.data).toBe("ZXY");
  });

  it("surfaces off-frame edits as drift diagnostics", () => {
    const scene = new BVHImporter().read(loadFixture("minimal.bvh"), "minimal.bvh").scene;
    scene.animations[0]!.channels[0]!.positionKeys[1]!.time = 1.25;

    const summary = analyzeBvhFrameDrift(scene);

    expect(summary.maxFrameDrift).toBeCloseTo(0.25);
    expect(summary.affectedChannels).toEqual(["Hips"]);
    expect(summary.diagnostics[0]?.code).toBe("BVH_FRAME_DRIFT");
  });

  it("produces text-stable output for unmodified scenes", () => {
    const scene = new BVHImporter().read(loadFixture("minimal.bvh"), "minimal.bvh").scene;
    const exporter = new BVHExporter();

    const outputA = new TextDecoder().decode(exporter.write(scene));
    const outputB = new TextDecoder().decode(exporter.write(scene));

    expect(outputA).toBe(outputB);
  });
});

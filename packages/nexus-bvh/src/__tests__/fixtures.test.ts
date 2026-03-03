import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BVHParser } from "../BVHParser";

function loadFixture(name: string): ArrayBuffer {
  const fixturesDir = resolve(fileURLToPath(new URL("../../fixtures", import.meta.url)));
  const file = readFileSync(resolve(fixturesDir, name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

describe("BVH canonical fixtures", () => {
  it("covers a basic skeleton fixture", () => {
    const document = new BVHParser().parse(loadFixture("basic-skeleton.bvh"));

    expect(document.root.name).toBe("Base");
    expect(document.root.children[0]?.name).toBe("Spine");
    expect(document.frameCount).toBe(1);
  });

  it("covers a root-motion fixture", () => {
    const document = new BVHParser().parse(loadFixture("root-motion.bvh"));

    expect(document.frameTime).toBeCloseTo(0.0166667);
    expect(document.motionValues[2]?.slice(0, 3)).toEqual([10, 1, 0]);
  });

  it("covers an alternate rotation-order fixture", () => {
    const document = new BVHParser().parse(loadFixture("rotation-yzx.bvh"));

    expect(document.root.rotationOrder).toBe("YZX");
    expect(document.root.children[0]?.rotationOrder).toBe("YZX");
  });
});

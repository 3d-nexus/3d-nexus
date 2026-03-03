import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BVHExporter } from "../BVHExporter";
import { BVHImporter } from "../BVHImporter";

function readFixture(name: string): ArrayBuffer {
  const file = readFileSync(join(import.meta.dirname, "../../fixtures", name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

describe("BVH smoke", () => {
  it("imports and exports the minimal fixture", () => {
    const importer = new BVHImporter();
    const exporter = new BVHExporter();
    const fixture = readFixture("minimal.bvh");

    const result = importer.read(fixture, "minimal.bvh");
    const output = exporter.write(result.scene);
    const roundtrip = importer.read(output, "roundtrip.bvh");

    expect(importer.canRead(fixture, "minimal.bvh")).toBe(true);
    expect(result.scene.rootNode.children[0]?.name).toBe("Hips");
    expect(result.scene.animations[0]?.channels[0]?.positionKeys[1]?.value).toMatchObject({ x: 1, y: 2, z: 3 });
    expect(roundtrip.scene.metadata["bvh:frameCount"]?.data).toBe("2");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MMDImporter } from "../MMDImporter";

const EXPECTED_BONES = 2;
const EXPECTED_MORPHS = 2;
const EXPECTED_VERTICES = 3;

function readFixture(name: string): ArrayBuffer {
  const file = readFileSync(join(import.meta.dirname, "../../fixtures", name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

describe("MMD integration fixture", () => {
  it("parses PMX fixture with skeleton, morphs, and physics", () => {
    const scene = new MMDImporter().read(readFixture("model.pmx"), "model.pmx").scene;
    const mesh = scene.meshes[0]!;

    expect(mesh.vertices.length).toBe(EXPECTED_VERTICES);
    expect(mesh.bones.length).toBe(EXPECTED_BONES);
    expect(mesh.morphTargets.length).toBe(EXPECTED_MORPHS);
    expect(mesh.morphTargets.some((target, index) => target.vertices.some((vertex, vertexIndex) => {
      const base = mesh.vertices[vertexIndex]!;
      return index === 0 && (vertex.x !== base.x || vertex.y !== base.y || vertex.z !== base.z);
    }))).toBe(true);
    expect(scene.metadata["mmd:rigidBodies"]).toBeDefined();
  });
});

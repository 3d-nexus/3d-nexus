import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MMDExporter } from "../MMDExporter";
import { MMDImporter } from "../MMDImporter";

function readFixture(name: string): ArrayBuffer {
  const file = readFileSync(join(import.meta.dirname, "../../fixtures", name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

function countMetadata(scene: ReturnType<MMDImporter["read"]>["scene"], key: string): number {
  const raw = scene.metadata[key]?.data;
  if (typeof raw !== "string") {
    return 0;
  }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.length : 0;
}

describe("MMD full roundtrip", () => {
  it("preserves skinning, morphs, and physics counts", () => {
    const importer = new MMDImporter();
    const exporter = new MMDExporter();
    const imported = importer.read(readFixture("model.pmx"), "model.pmx").scene;
    const roundtripped = importer.read(exporter.write(imported, { format: "pmx" }), "roundtrip.pmx").scene;

    expect(roundtripped.meshes[0]?.vertices.length).toBe(imported.meshes[0]?.vertices.length);
    expect(roundtripped.meshes[0]?.bones.length).toBe(imported.meshes[0]?.bones.length);
    expect(roundtripped.meshes[0]?.morphTargets.length).toBe(imported.meshes[0]?.morphTargets.length);
    expect(countMetadata(roundtripped, "mmd:rigidBodies")).toBe(countMetadata(imported, "mmd:rigidBodies"));
  });
});

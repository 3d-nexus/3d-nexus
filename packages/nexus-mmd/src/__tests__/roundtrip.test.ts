import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MMDExporter } from "../MMDExporter";
import { MMDImporter } from "../MMDImporter";

describe("MMD roundtrip", () => {
  it("preserves PMX vertex count", () => {
    const fixtureDir = join(import.meta.dirname, "fixtures");
    const file = readFileSync(join(fixtureDir, "minimal.pmx"));
    const pmxBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const importer = new MMDImporter();
    const exporter = new MMDExporter();

    const imported = importer.read(pmxBuffer, "minimal.pmx");
    const exported = exporter.write(imported.scene, { format: "pmx" });
    const reparsed = importer.read(exported, "roundtrip.pmx");

    expect(imported.scene.meshes[0]?.vertices.length).toBe(reparsed.scene.meshes[0]?.vertices.length);
  });
});

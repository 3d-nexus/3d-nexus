import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FBXExporter } from "../FBXExporter";
import { FBXImporter } from "../FBXImporter";

describe("FBX roundtrip", () => {
  it("preserves mesh name and vertex count", () => {
    const file = readFileSync(join(import.meta.dirname, "fixtures", "cube.fbx"));
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const importer = new FBXImporter();
    const exporter = new FBXExporter();

    const imported = importer.read(buffer, "cube.fbx").scene;
    const exported = exporter.write(imported);
    const reparsed = importer.read(exported, "roundtrip.fbx").scene;

    expect(reparsed.meshes[0]?.name).toBe(imported.meshes[0]?.name);
    expect(reparsed.meshes[0]?.vertices.length).toBe(imported.meshes[0]?.vertices.length);
  });
});

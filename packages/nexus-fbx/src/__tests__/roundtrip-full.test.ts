import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FBXExporter } from "../FBXExporter";
import { FBXImporter } from "../FBXImporter";

function readFixture(name: string): ArrayBuffer {
  const file = readFileSync(join(import.meta.dirname, "../../fixtures", name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

describe("FBX full roundtrip", () => {
  it("preserves mesh, skinning, and animation channel counts", () => {
    const importer = new FBXImporter();
    const exporter = new FBXExporter();
    const imported = importer.read(readFixture("character.fbx"), "character.fbx").scene;
    const roundtripped = importer.read(exporter.write(imported), "roundtrip.fbx").scene;

    expect(roundtripped.meshes.length).toBe(imported.meshes.length);
    expect(roundtripped.meshes[0]?.bones.length).toBe(imported.meshes[0]?.bones.length);
    expect(roundtripped.animations[0]?.channels.length).toBe(imported.animations[0]?.channels.length);
    expect(roundtripped.animations[0]?.channels[0]?.positionKeys.length).toBe(imported.animations[0]?.channels[0]?.positionKeys.length);
  });
});

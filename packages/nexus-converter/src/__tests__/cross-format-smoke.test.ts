import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FBXImporter } from "nexus-fbx";
import { MMDImporter } from "nexus-mmd";
import { ObjFileImporter } from "nexus-obj";
import { ModelConverter } from "../ModelConverter";

function readFixture(pathParts: string[]): ArrayBuffer {
  const file = readFileSync(join(import.meta.dirname, ...pathParts));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

describe("ModelConverter cross-format smoke", () => {
  it("supports PMX to FBX and FBX to OBJ without empty meshes", () => {
    const converter = new ModelConverter();
    const pmx = readFixture(["../../../nexus-mmd/fixtures", "model.pmx"]);
    const fbxFixture = readFixture(["../../../nexus-fbx/fixtures", "character.fbx"]);

    const convertedFbx = converter.convert(pmx, "pmx", "fbx");
    const convertedObj = converter.convert(fbxFixture, "fbx", "obj");

    expect(new FBXImporter().read(convertedFbx, "converted.fbx").scene.meshes[0]?.vertices.length).toBeGreaterThan(0);
    expect(new ObjFileImporter().read(convertedObj, "converted.obj").scene.meshes[0]?.vertices.length).toBeGreaterThan(0);
    expect(new MMDImporter().read(pmx, "model.pmx").scene.meshes[0]?.vertices.length).toBeGreaterThan(0);
  });
});

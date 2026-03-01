import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FBXImporter } from "../FBXImporter";

describe("FBXConverter", () => {
  it("parses cube.fbx into one mesh and one material", () => {
    const file = readFileSync(join(import.meta.dirname, "fixtures", "cube.fbx"));
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const scene = new FBXImporter().read(buffer, "cube.fbx").scene;

    expect(scene.meshes).toHaveLength(1);
    expect(scene.meshes[0]?.vertices).toHaveLength(8);
    expect(scene.meshes[0]?.faces).toHaveLength(6);
    expect(scene.materials[0]?.name).toBe("CubeMaterial");
  });
});

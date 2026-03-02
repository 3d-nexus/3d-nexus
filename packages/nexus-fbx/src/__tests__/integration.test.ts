import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FBXImporter } from "../FBXImporter";

function readFixture(name: string): ArrayBuffer {
  const file = readFileSync(join(import.meta.dirname, "../../fixtures", name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

describe("FBX integration fixture", () => {
  it("parses FBX fixture with bones, animation, blendshapes, and normalized coords", () => {
    const scene = new FBXImporter().read(readFixture("character.fbx"), "character.fbx").scene;

    expect(scene.meshes[0]?.bones.length).toBeGreaterThan(0);
    expect(scene.meshes[0]?.morphTargets.length).toBeGreaterThan(0);
    expect(scene.animations.length).toBeGreaterThan(0);
    expect(scene.animations[0]?.channels.length).toBeGreaterThan(0);
    expect(Array.from(scene.rootNode.transformation.data)).not.toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });
});

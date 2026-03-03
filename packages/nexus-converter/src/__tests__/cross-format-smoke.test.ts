import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FBXImporter } from "@3d-nexus/fbx";
import { ObjFileImporter } from "@3d-nexus/obj";
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
    expect(convertedFbx.byteLength).toBeGreaterThan(0);
  });

  it("supports BVH to FBX to BVH for meshless skeleton motion", () => {
    const converter = new ModelConverter();
    const bvh = readFixture(["../../../nexus-bvh/fixtures", "minimal.bvh"]);

    const convertedFbx = converter.convert(bvh, "bvh", "fbx");
    const roundtrippedBvh = converter.convert(convertedFbx, "fbx", "bvh");

    const importedFbx = new FBXImporter().read(convertedFbx, "converted.fbx").scene;
    const importedBvh = new TextDecoder().decode(roundtrippedBvh);

    expect(importedFbx.meshes.length).toBe(0);
    expect(importedFbx.animations[0]?.channels.length).toBeGreaterThan(0);
    expect(importedBvh).toContain("HIERARCHY");
    expect(importedBvh).toContain("ROOT Root");
    expect(importedBvh).toContain("JOINT Hips");
  });

  it("supports BVH to VMD conversion with explicit compatibility diagnostics", () => {
    const converter = new ModelConverter();
    const bvh = readFixture(["../../../nexus-bvh/fixtures", "minimal.bvh"]);

    const result = converter.convertWithReport(bvh, "bvh", "vmd", {
      compatibilityProfile: "bvh",
    });

    expect(result.output.byteLength).toBeGreaterThan(0);
    expect(result.report?.checks.find((entry) => entry.capability === "bvh-skeleton-motion")?.outcome).toBe("degraded");
    expect(result.report?.checks.find((entry) => entry.capability === "bvh-animation-fidelity")?.outcome).toBe("normalized");
  });
});


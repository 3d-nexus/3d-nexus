import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ObjExporter } from "../ObjExporter";
import { ObjFileImporter } from "../ObjFileImporter";

describe("OBJ roundtrip", () => {
  it("preserves vertex and face counts", () => {
    const fixtureDir = join(import.meta.dirname, "fixtures");
    const importer = new ObjFileImporter();
    const exporter = new ObjExporter();
    const objBuffer = readFileSync(join(fixtureDir, "cube.obj")).buffer.slice(0);
    const mtlText = readFileSync(join(fixtureDir, "cube.mtl"), "utf8");

    const imported = importer.read(objBuffer, "cube.obj", { mtlText });
    const exportedBuffer = exporter.write(imported.scene, { mtlFileName: "cube.mtl" });
    const reparsed = importer.read(exportedBuffer, "cube.obj", { mtlText: exporter.getMtlContent() });

    const importedVertexCount = imported.scene.meshes.reduce((sum, mesh) => sum + mesh.vertices.length, 0);
    const reparsedVertexCount = reparsed.scene.meshes.reduce((sum, mesh) => sum + mesh.vertices.length, 0);
    const importedFaceCount = imported.scene.meshes.reduce((sum, mesh) => sum + mesh.faces.length, 0);
    const reparsedFaceCount = reparsed.scene.meshes.reduce((sum, mesh) => sum + mesh.faces.length, 0);

    expect(importedVertexCount).toBe(reparsedVertexCount);
    expect(importedFaceCount).toBe(reparsedFaceCount);
    expect(exporter.getMtlContent()).toContain("map_Kd textures/cube.png");
  });
});

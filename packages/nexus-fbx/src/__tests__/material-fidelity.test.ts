import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FBXExporter } from "../FBXExporter";
import { FBXImporter } from "../FBXImporter";

function readFixture(name: string): ArrayBuffer {
  const file = readFileSync(join(import.meta.dirname, "../../fixtures", name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

describe("FBX material fidelity", () => {
  it("preserves shading-model fallback metadata, uv routing, texture transforms, unicode paths, and deterministic export", () => {
    const importer = new FBXImporter();
    const scene = importer.read(readFixture("unicode-texture.fbx"), "unicode-texture.fbx").scene;
    const material = scene.materials[0]!;
    const binding = (material.metadata?.textureBindings as Array<Record<string, unknown>>)[0]!;
    const diagnostics = JSON.parse(String(scene.metadata["nexus:compatDiagnostics"]?.data ?? "[]"));
    const exporter = new FBXExporter();

    expect(material.metadata?.fbxShadingModel).toBe("MayaPBR");
    expect(binding.uvSet).toBe("map2");
    expect(binding.relativeFilename).toBe("纹理/漫反射.png");
    expect((binding.translation as number[])[0]).toBeCloseTo(0.1);
    expect(scene.meshes[0]?.textureCoords[1]?.length).toBe(3);
    expect(diagnostics.some((entry: { code?: string }) => entry.code === "FBX_MATERIAL_FALLBACK")).toBe(true);

    const outputA = exporter.write(scene);
    const outputB = exporter.write(scene);
    const exported = importer.read(outputA, "unicode-texture-roundtrip.fbx").scene;
    const exportedBinding = (exported.materials[0]?.metadata?.textureBindings as Array<Record<string, unknown>>)[0]!;

    expect(new TextDecoder("ascii").decode(outputA.slice(0, 23))).toBe("Kaydara FBX Binary  \0\x1a\0");
    expect(Array.from(new Uint8Array(outputA))).toEqual(Array.from(new Uint8Array(outputB)));
    expect(exportedBinding.relativeFilename).toBe("纹理/漫反射.png");
    expect(exportedBinding.uvSet).toBe("map2");
  });
});

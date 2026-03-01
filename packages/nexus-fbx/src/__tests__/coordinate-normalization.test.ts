import { describe, expect, it } from "vitest";
import { FBXImporter } from "../FBXImporter";

function createAsciiFbx(globalSettings: string): ArrayBuffer {
  const text = [
    "; FBX 7.4.0 project file",
    "FBXHeaderExtension: {",
    "  FBXVersion: 7400",
    "}",
    "GlobalSettings: {",
    globalSettings,
    "}",
    "Objects: {",
    '  Geometry: 1, "Geometry::Mesh", "Mesh" {',
    "    Vertices: 0,0,0,1,0,0,0,1,0",
    "    PolygonVertexIndex: 0,1,-3",
    "    Normals: 0,1,0,0,1,0,0,1,0",
    "    UV: 0,0,1,0,0,1",
    "  }",
    '  Material: 2, "Material::Mat", "Material" {',
    "  }",
    '  Model: 3, "Model::Mesh", "Model" {',
    "  }",
    "}",
    "Connections: {",
    '  C: "OO", 1, 3',
    '  C: "OO", 2, 3',
    "}",
    "Takes: {",
    "}",
  ].join("\n");
  return new TextEncoder().encode(text).buffer;
}

describe("FBX coordinate normalization", () => {
  it("applies Z-up to Y-up root transform", () => {
    const scene = new FBXImporter().read(
      createAsciiFbx("  UpAxis: 2\n  UpAxisSign: 1\n  FrontAxis: 1\n  FrontAxisSign: -1\n  CoordAxis: 0\n  CoordAxisSign: 1\n  UnitScaleFactor: 100"),
      "zup.fbx",
    ).scene;

    expect(scene.rootNode.transformation.data[0]).toBeCloseTo(1);
    expect(scene.rootNode.transformation.data[6]).toBeCloseTo(-1);
    expect(scene.rootNode.transformation.data[9]).toBeCloseTo(1);
  });

  it("keeps canonical Y-up root transform as identity", () => {
    const scene = new FBXImporter().read(
      createAsciiFbx("  UpAxis: 1\n  UpAxisSign: 1\n  FrontAxis: 2\n  FrontAxisSign: 1\n  CoordAxis: 0\n  CoordAxisSign: 1\n  UnitScaleFactor: 100"),
      "yup.fbx",
    ).scene;

    expect(Array.from(scene.rootNode.transformation.data)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    expect(scene.metadata["nexus:unitScaleFactor"]?.data).toBe(1);
  });
});

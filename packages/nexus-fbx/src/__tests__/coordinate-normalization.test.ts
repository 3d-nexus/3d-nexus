import { describe, expect, it } from "vitest";
import { FBXBinaryWriter } from "../FBXBinaryWriter";
import { FbxExportNode } from "../FBXExportNode";
import { FBXImporter } from "../FBXImporter";

interface AxisSettings {
  upAxis: number;
  upAxisSign: number;
  frontAxis: number;
  frontAxisSign: number;
  coordAxis: number;
  coordAxisSign: number;
  unitScaleFactor: number;
}

function createBinaryFbx(settings: AxisSettings): ArrayBuffer {
  return new FBXBinaryWriter().writeNodes([
    new FbxExportNode("FBXHeaderExtension", [], ["FBXVersion: 7400"]),
    new FbxExportNode(
      "GlobalSettings",
      [],
      [
        `UpAxis: ${settings.upAxis}`,
        `UpAxisSign: ${settings.upAxisSign}`,
        `FrontAxis: ${settings.frontAxis}`,
        `FrontAxisSign: ${settings.frontAxisSign}`,
        `CoordAxis: ${settings.coordAxis}`,
        `CoordAxisSign: ${settings.coordAxisSign}`,
        `UnitScaleFactor: ${settings.unitScaleFactor}`,
      ],
    ),
    new FbxExportNode(
      "Objects",
      [],
      [],
      [
        new FbxExportNode(
          "Geometry",
          [1, "Geometry::Mesh", "Mesh"],
          ["Vertices: 0,0,0,1,0,0,0,1,0", "PolygonVertexIndex: 0,1,-3", "Normals: 0,1,0,0,1,0,0,1,0", "UV: 0,0,1,0,0,1"],
        ),
        new FbxExportNode("Material", [2, "Material::Mat", "Material"]),
        new FbxExportNode("Model", [3, "Model::Mesh", "Model"]),
      ],
    ),
    new FbxExportNode("Connections", [], ['C: "OO", 1, 3', 'C: "OO", 2, 3']),
    new FbxExportNode("Takes"),
  ]);
}

describe("FBX coordinate normalization", () => {
  it("applies Z-up to Y-up root transform", () => {
    const scene = new FBXImporter().read(
      createBinaryFbx({ upAxis: 2, upAxisSign: 1, frontAxis: 1, frontAxisSign: -1, coordAxis: 0, coordAxisSign: 1, unitScaleFactor: 100 }),
      "zup.fbx",
    ).scene;

    expect(scene.rootNode.transformation.data[0]).toBeCloseTo(1);
    expect(scene.rootNode.transformation.data[6]).toBeCloseTo(-1);
    expect(scene.rootNode.transformation.data[9]).toBeCloseTo(1);
  });

  it("keeps canonical Y-up root transform as identity", () => {
    const scene = new FBXImporter().read(
      createBinaryFbx({ upAxis: 1, upAxisSign: 1, frontAxis: 2, frontAxisSign: 1, coordAxis: 0, coordAxisSign: 1, unitScaleFactor: 100 }),
      "yup.fbx",
    ).scene;

    expect(Array.from(scene.rootNode.transformation.data)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    expect(scene.metadata["nexus:unitScaleFactor"]?.data).toBe(1);
  });
});

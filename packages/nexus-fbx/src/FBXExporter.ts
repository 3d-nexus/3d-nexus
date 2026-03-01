import { type AiScene, type BaseExporter, type ExportSettings } from "nexus-core";
import { FbxExportNode } from "./FBXExportNode";

function flattenVertices(scene: AiScene): string {
  return scene.meshes[0]?.vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]).join(",") ?? "";
}

function flattenPolygonIndices(scene: AiScene): string {
  return (
    scene.meshes[0]?.faces
      .flatMap((face) => face.indices.map((index, idx) => (idx === face.indices.length - 1 ? -(index + 1) : index)))
      .join(",") ?? ""
  );
}

function flattenNormals(scene: AiScene): string {
  return scene.meshes[0]?.normals.flatMap((normal) => [normal.x, normal.y, normal.z]).join(",") ?? "";
}

function flattenUvs(scene: AiScene): string {
  return scene.meshes[0]?.textureCoords[0]?.flatMap((uv) => [uv.x, uv.y]).join(",") ?? "";
}

export class FBXExporter implements BaseExporter {
  getSupportedExtensions(): string[] {
    return ["fbx"];
  }

  write(scene: AiScene, _settings?: ExportSettings): ArrayBuffer {
    const geometry = new FbxExportNode(
      "Geometry",
      [1, "Geometry::Mesh", "Mesh"],
      [
        `Vertices: ${flattenVertices(scene)}`,
        `PolygonVertexIndex: ${flattenPolygonIndices(scene)}`,
        `Normals: ${flattenNormals(scene)}`,
        `UV: ${flattenUvs(scene)}`,
      ],
    );
    const material = new FbxExportNode(
      "Material",
      [2, `Material::${scene.materials[0]?.name ?? "Material"}`, "Material"],
      [],
      [
        new FbxExportNode("Properties70", [], [
          'P: "DiffuseColor", "Color", "", "A", 0.8, 0.6, 0.4',
        ]),
      ],
    );
    const model = new FbxExportNode("Model", [3, "Model::Root", "Model"]);
    const objects = new FbxExportNode("Objects", [], [], [geometry, material, model]);
    const connections = new FbxExportNode("Connections", [], [
      'C: "OO", 1, 3',
      'C: "OO", 2, 3',
    ]);
    const globalSettings = new FbxExportNode("GlobalSettings", [], [
      'UpAxis: 1',
      'FrontAxis: 2',
      'CoordAxis: 0',
    ]);

    const text = [
      "; FBX 7.4.0 project file",
      "; Created by nexus-fbx",
      "FBXHeaderExtension: {",
      "  FBXVersion: 7400",
      "}",
      globalSettings.render(),
      objects.render(),
      connections.render(),
      "Takes: {",
      "}",
    ].join("\n");

    return new TextEncoder().encode(text).buffer;
  }
}

import { type AiScene, type BaseExporter, type ExportSettings } from "nexus-core";
import { FbxExportNode } from "./FBXExportNode";

const ROOT_MODEL_ID = 100000;
const BASE_NODE_ID = 100001;

function flattenVertices(mesh: AiScene["meshes"][number]): string {
  return mesh.vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]).join(",");
}

function flattenPolygonIndices(mesh: AiScene["meshes"][number]): string {
  return mesh.faces
    .flatMap((face) => face.indices.map((index, idx) => (idx === face.indices.length - 1 ? -(index + 1) : index)))
    .join(",");
}

function flattenNormals(mesh: AiScene["meshes"][number]): string {
  return mesh.normals.flatMap((normal) => [normal.x, normal.y, normal.z]).join(",");
}

function flattenUvs(mesh: AiScene["meshes"][number]): string {
  return mesh.textureCoords[0]?.flatMap((uv) => [uv.x, uv.y]).join(",") ?? "";
}

function renderMaterialNode(id: number, name: string): FbxExportNode {
  return new FbxExportNode(
    "Material",
    [id, `Material::${name}`, "Material"],
    [],
    [
      new FbxExportNode("Properties70", [], [
        'P: "DiffuseColor", "Color", "", "A", 0.8, 0.6, 0.4',
      ]),
    ],
  );
}

export class FBXExporter implements BaseExporter {
  getSupportedExtensions(): string[] {
    return ["fbx"];
  }

  write(scene: AiScene, _settings?: ExportSettings): ArrayBuffer {
    const objects: FbxExportNode[] = [];
    const connectionLines: string[] = [];
    const materialIdMap = new Map<number, number>();
    let nextId = BASE_NODE_ID;

    scene.meshes.forEach((mesh, meshIndex) => {
      const geometryId = nextId++;
      const modelId = nextId++;
      objects.push(
        new FbxExportNode(
          "Geometry",
          [geometryId, `Geometry::${mesh.name || `Mesh_${meshIndex}`}`, "Mesh"],
          [
            `Vertices: ${flattenVertices(mesh)}`,
            `PolygonVertexIndex: ${flattenPolygonIndices(mesh)}`,
            `Normals: ${flattenNormals(mesh)}`,
            `UV: ${flattenUvs(mesh)}`,
          ],
        ),
      );
      objects.push(new FbxExportNode("Model", [modelId, `Model::${mesh.name || `Mesh_${meshIndex}`}`, "Model"]));
      connectionLines.push(`C: "OO", ${modelId}, ${geometryId}`);
      connectionLines.push(`C: "OO", ${modelId}, ${ROOT_MODEL_ID}`);

      if (!materialIdMap.has(mesh.materialIndex)) {
        const materialId = nextId++;
        materialIdMap.set(mesh.materialIndex, materialId);
        objects.push(renderMaterialNode(materialId, scene.materials[mesh.materialIndex]?.name ?? `Material_${mesh.materialIndex}`));
      }
      connectionLines.push(`C: "OO", ${materialIdMap.get(mesh.materialIndex)}, ${modelId}`);
    });

    objects.push(new FbxExportNode("Model", [ROOT_MODEL_ID, "Model::Root", "Model"]));

    const text = [
      "; FBX 7.4.0 project file",
      "; Created by nexus-fbx",
      "FBXHeaderExtension: {",
      "  FBXVersion: 7400",
      "}",
      new FbxExportNode("GlobalSettings", [], [
        "UpAxis: 1",
        "UpAxisSign: 1",
        "FrontAxis: 2",
        "FrontAxisSign: 1",
        "CoordAxis: 0",
        "CoordAxisSign: 1",
        "UnitScaleFactor: 1.0",
      ]).render(),
      new FbxExportNode("Objects", [], [], objects).render(),
      new FbxExportNode("Connections", [], connectionLines).render(),
      "Takes: {",
      "}",
    ].join("\n");

    return new TextEncoder().encode(text).buffer;
  }
}

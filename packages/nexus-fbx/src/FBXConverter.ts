import { AiPrimitiveType, AiSceneFlags, createIdentityMatrix4x4, type AiNode, type AiScene } from "nexus-core";
import { FbxDocument } from "./FBXDocument";

function parseNumberList(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item));
  }
  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number);
}

export class FBXConverter {
  convert(document: FbxDocument): AiScene {
    const geometries = [...document.objects.values()].filter((object) => object.kind === "Mesh");
    const materials = [...document.objects.values()].filter((object) => object.kind === "Material");
    const models = [...document.objects.values()].filter((object) => object.kind === "Model");

    const meshes = geometries.map((geometry, geometryIndex) => {
      const vertices = parseNumberList(geometry.element.values.Vertices?.[0] ?? []).reduce<
        Array<{ x: number; y: number; z: number }>
      >((acc, value, index, all) => {
        if (index % 3 === 0) {
          acc.push({ x: value, y: all[index + 1] ?? 0, z: all[index + 2] ?? 0 });
        }
        return acc;
      }, []);
      const polygonIndex = parseNumberList(geometry.element.values.PolygonVertexIndex?.[0] ?? []);
      const faces: Array<{ indices: number[] }> = [];
      let current: number[] = [];
      polygonIndex.forEach((index) => {
        const isLast = index < 0;
        current.push(isLast ? Math.abs(index) - 1 : index);
        if (isLast) {
          faces.push({ indices: current });
          current = [];
        }
      });
      const normalNumbers = parseNumberList(geometry.element.values.Normals?.[0] ?? []);
      const uvNumbers = parseNumberList(geometry.element.values.UV?.[0] ?? []);
      return {
        name: String(geometry.properties.get("Name") ?? geometry.name),
        primitiveTypes: faces.some((face) => face.indices.length > 3)
          ? AiPrimitiveType.POLYGON
          : AiPrimitiveType.TRIANGLE,
        vertices,
        normals: normalNumbers.reduce<Array<{ x: number; y: number; z: number }>>((acc, value, index, all) => {
          if (index % 3 === 0) {
            acc.push({ x: value, y: all[index + 1] ?? 0, z: all[index + 2] ?? 0 });
          }
          return acc;
        }, []),
        tangents: [],
        bitangents: [],
        textureCoords: [
          uvNumbers.reduce<Array<{ x: number; y: number; z: number }>>((acc, value, index, all) => {
            if (index % 2 === 0) {
              acc.push({ x: value, y: all[index + 1] ?? 0, z: 0 });
            }
            return acc;
          }, []),
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        colors: Array.from({ length: 8 }, () => null),
        faces,
        bones: [],
        materialIndex: materials.length > 0 ? Math.min(geometryIndex, materials.length - 1) : 0,
        morphTargets: [],
        aabb: {
          min: {
            x: Math.min(...vertices.map((vertex) => vertex.x)),
            y: Math.min(...vertices.map((vertex) => vertex.y)),
            z: Math.min(...vertices.map((vertex) => vertex.z)),
          },
          max: {
            x: Math.max(...vertices.map((vertex) => vertex.x)),
            y: Math.max(...vertices.map((vertex) => vertex.y)),
            z: Math.max(...vertices.map((vertex) => vertex.z)),
          },
        },
      };
    });

    const childNodes: AiNode[] = models.map((model, index) => ({
      name: model.name,
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [],
      meshIndices: meshes[index] ? [index] : [],
      metadata: null,
    }));
    const rootNode: AiNode = {
      name: "FBXRoot",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: childNodes,
      meshIndices: [],
      metadata: null,
    };
    childNodes.forEach((child) => {
      child.parent = rootNode;
    });

    return {
      flags: 0 as AiSceneFlags,
      rootNode,
      meshes,
      materials: materials.map((material) => ({
        name: material.name.replace(/^Material::/, ""),
        properties: [
          {
            key: "$clr.diffuse",
            semantic: 1,
            index: 0,
            type: 0,
            data: material.properties.get("DiffuseColor") ?? { r: 1, g: 1, b: 1, a: 1 },
          },
        ],
      })),
      animations: [],
      textures: [],
      lights: [],
      cameras: [],
      metadata: {},
    };
  }
}

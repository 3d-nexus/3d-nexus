import {
  AiPrimitiveType,
  AiPropertyTypeInfo,
  AiSceneFlags,
  AiTextureType,
  createIdentityMatrix4x4,
  type AiAABB,
  type AiMaterial,
  type AiMaterialProperty,
  type AiMesh,
  type AiNode,
  type AiScene,
  type BaseImporter,
  type ImportResult,
  type ImportSettings,
} from "@3d-nexus/core";
import type { ObjFace, ObjMaterial, ObjModel } from "./ObjFileData";
import { ObjFileMtlParser } from "./ObjFileMtlParser";
import { ObjFileParser } from "./ObjFileParser";

function createEmptyAabb(): AiAABB {
  return {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 0, y: 0, z: 0 },
  };
}

function updateAabb(aabb: AiAABB, x: number, y: number, z: number): AiAABB {
  return {
    min: {
      x: Math.min(aabb.min.x, x),
      y: Math.min(aabb.min.y, y),
      z: Math.min(aabb.min.z, z),
    },
    max: {
      x: Math.max(aabb.max.x, x),
      y: Math.max(aabb.max.y, y),
      z: Math.max(aabb.max.z, z),
    },
  };
}

function createMaterialProperty(
  key: string,
  semantic: AiTextureType,
  type: AiPropertyTypeInfo,
  data: unknown,
): AiMaterialProperty {
  return { key, semantic, index: 0, type, data };
}

function convertMaterial(material: ObjMaterial): AiMaterial {
  const properties: AiMaterialProperty[] = [];
  if (material.diffuse) {
    properties.push(
      createMaterialProperty("$clr.diffuse", AiTextureType.DIFFUSE, AiPropertyTypeInfo.FLOAT, {
        ...material.diffuse,
        a: material.dissolve ?? 1,
      }),
    );
  }

  if (material.ambient) {
    properties.push(
      createMaterialProperty("$clr.ambient", AiTextureType.AMBIENT, AiPropertyTypeInfo.FLOAT, {
        ...material.ambient,
        a: 1,
      }),
    );
  }

  if (material.specular) {
    properties.push(
      createMaterialProperty("$clr.specular", AiTextureType.SPECULAR, AiPropertyTypeInfo.FLOAT, {
        ...material.specular,
        a: 1,
      }),
    );
  }

  if (material.textureDiffuse) {
    properties.push(
      createMaterialProperty(
        "$tex.file",
        AiTextureType.DIFFUSE,
        AiPropertyTypeInfo.STRING,
        material.textureDiffuse,
      ),
    );
  }

  return {
    name: material.name,
    properties,
  };
}

function buildMesh(model: ObjModel, faces: ObjFace[], materialIndex: number, name: string): AiMesh {
  const vertices = [];
  const normals = [];
  const textureCoords = Array.from({ length: 8 }, () => null as AiMesh["textureCoords"][number]);
  textureCoords[0] = [];
  let aabb = createEmptyAabb();
  const aiFaces = [];
  let hasVertices = false;

  for (const face of faces) {
    const indices: number[] = [];
    for (const vertex of face.vertices) {
      const sourceVertex = model.vertices[vertex.vertexIndex];
      if (!sourceVertex) {
        continue;
      }

      const nextIndex = vertices.length;
      vertices.push(sourceVertex);
      indices.push(nextIndex);
      aabb = hasVertices
        ? updateAabb(aabb, sourceVertex.x, sourceVertex.y, sourceVertex.z)
        : {
            min: { ...sourceVertex },
            max: { ...sourceVertex },
          };
      hasVertices = true;

      if (vertex.normalIndex >= 0) {
        normals.push(model.normals[vertex.normalIndex]!);
      }

      if (vertex.textureIndex >= 0) {
        textureCoords[0]!.push({
          x: model.textureCoords[vertex.textureIndex]!.x,
          y: model.textureCoords[vertex.textureIndex]!.y,
          z: 0,
        });
      }
    }

    aiFaces.push({ indices });
  }

  if (!textureCoords[0]?.length) {
    textureCoords[0] = null;
  }

  return {
    name,
    primitiveTypes: aiFaces.some((face) => face.indices.length > 3)
      ? AiPrimitiveType.POLYGON
      : AiPrimitiveType.TRIANGLE,
    vertices,
    normals,
    tangents: [],
    bitangents: [],
    textureCoords,
    colors: Array.from({ length: 8 }, () => null),
    faces: aiFaces,
    bones: [],
    materialIndex,
    morphTargets: [],
    aabb,
  };
}

export class ObjFileImporter implements BaseImporter {
  private readonly parser = new ObjFileParser();
  private readonly mtlParser = new ObjFileMtlParser();

  canRead(buffer: ArrayBuffer, filename: string): boolean {
    if (!filename.toLowerCase().endsWith(".obj")) {
      return false;
    }

    const text = new TextDecoder().decode(buffer.slice(0, 128));
    return /^[#\s]*(v|o|g|mtllib|usemtl)\b/m.test(text);
  }

  read(buffer: ArrayBuffer, _filename: string, settings?: ImportSettings): ImportResult {
    const text = new TextDecoder().decode(buffer);
    const model = this.parser.parse(text);
    const warnings: ImportResult["warnings"] = [];
    const materials = settings?.mtlText
      ? this.mtlParser.parse(settings.mtlText)
      : [];

    if (!settings?.mtlText && model.materialLibraries.length > 0) {
      warnings.push({
        code: "MISSING_MTL_FILE",
        message: `Material library not provided: ${model.materialLibraries.join(", ")}`,
        context: { libraries: model.materialLibraries },
      });
    }

    model.materials = materials;
    const aiMaterials =
      materials.length > 0
        ? materials.map((material) => convertMaterial(material))
        : [{ name: "DefaultMaterial", properties: [] }];
    const materialIndexByName = new Map(aiMaterials.map((material, index) => [material.name, index]));

    const meshes: AiMesh[] = [];
    const childNodes: AiNode[] = [];

    for (const object of model.objects) {
      const objectMeshIndices: number[] = [];

      for (const group of object.groups) {
        if (group.faces.length === 0) {
          continue;
        }

        const materialIndex =
          group.materialName && materialIndexByName.has(group.materialName)
            ? materialIndexByName.get(group.materialName)!
            : 0;
        const mesh = buildMesh(
          model,
          group.faces,
          materialIndex,
          `${object.name}:${group.name}:${group.materialName ?? "default"}`,
        );
        objectMeshIndices.push(meshes.length);
        meshes.push(mesh);
      }

      childNodes.push({
        name: object.name,
        transformation: createIdentityMatrix4x4(),
        parent: null,
        children: [],
        meshIndices: objectMeshIndices,
        metadata: null,
      });
    }

    const rootNode: AiNode = {
      name: "RootNode",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: childNodes,
      meshIndices: [],
      metadata: null,
    };

    for (const child of childNodes) {
      child.parent = rootNode;
    }

    const scene: AiScene = {
      flags: meshes.length > 0 ? (0 as AiSceneFlags) : AiSceneFlags.AI_SCENE_FLAGS_INCOMPLETE,
      rootNode,
      meshes,
      materials: aiMaterials,
      animations: [],
      textures: [],
      lights: [],
      cameras: [],
      metadata: {},
    };

    return { scene, warnings };
  }
}


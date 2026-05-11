import {
  AiMetadataType,
  AiPrimitiveType,
  AiPropertyTypeInfo,
  AiSceneFlags,
  AiTextureType,
  createIdentityMatrix4x4,
  type AiAABB,
  type AiMaterial,
  type AiMatrix4x4,
  type AiMesh,
  type AiNode,
  type AiScene,
  type AiVector3D,
  type BaseImporter,
  type ImportResult,
  type ImportSettings,
} from "@3d-nexus/core";
import { isGlb, readGlb } from "./glb";
import type { GltfAccessor, GltfAsset, GltfBufferView, GltfMaterial, GltfNode } from "./gltfTypes";

const COMPONENT_FLOAT = 5126;
const COMPONENT_UNSIGNED_SHORT = 5123;
const COMPONENT_UNSIGNED_INT = 5125;
const MODE_TRIANGLES = 4;

function readJson(buffer: ArrayBuffer): GltfAsset {
  return JSON.parse(new TextDecoder().decode(buffer)) as GltfAsset;
}

function readDataUri(uri: string): ArrayBuffer | null {
  const match = /^data:.*?;base64,(.+)$/i.exec(uri);
  if (!match) {
    return null;
  }
  const binary = atob(match[1]!);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function resolveBuffer(asset: GltfAsset, glbBin: ArrayBuffer, settings?: ImportSettings): ArrayBuffer {
  const buffer = asset.buffers?.[0];
  const settingBuffer = settings?.binBuffer;
  if (settingBuffer instanceof ArrayBuffer) {
    return settingBuffer;
  }
  if (glbBin.byteLength > 0) {
    return glbBin;
  }
  if (typeof buffer?.uri === "string") {
    const dataUri = readDataUri(buffer.uri);
    if (dataUri) {
      return dataUri;
    }
  }
  throw new Error("glTF input requires a GLB BIN chunk, data URI buffer, or settings.binBuffer");
}

function componentSize(componentType: number): number {
  if (componentType === COMPONENT_FLOAT || componentType === COMPONENT_UNSIGNED_INT) return 4;
  if (componentType === COMPONENT_UNSIGNED_SHORT) return 2;
  throw new Error(`Unsupported glTF component type: ${componentType}`);
}

function componentCount(type: GltfAccessor["type"]): number {
  if (type === "SCALAR") return 1;
  if (type === "VEC2") return 2;
  if (type === "VEC3") return 3;
  if (type === "VEC4") return 4;
  if (type === "MAT4") return 16;
  throw new Error(`Unsupported glTF accessor type: ${type}`);
}

function accessorView(asset: GltfAsset, accessorIndex: number): { accessor: GltfAccessor; view: GltfBufferView } {
  const accessor = asset.accessors?.[accessorIndex];
  if (!accessor || accessor.bufferView === undefined) {
    throw new Error(`Invalid glTF accessor: ${accessorIndex}`);
  }
  const view = asset.bufferViews?.[accessor.bufferView];
  if (!view) {
    throw new Error(`Invalid glTF bufferView: ${accessor.bufferView}`);
  }
  return { accessor, view };
}

function readAccessorNumbers(asset: GltfAsset, buffer: ArrayBuffer, accessorIndex: number): number[] {
  const { accessor, view } = accessorView(asset, accessorIndex);
  const count = componentCount(accessor.type);
  const stride = view.byteStride ?? componentSize(accessor.componentType) * count;
  const baseOffset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const data = new DataView(buffer);
  const values: number[] = [];

  for (let item = 0; item < accessor.count; item += 1) {
    const itemOffset = baseOffset + item * stride;
    for (let component = 0; component < count; component += 1) {
      const offset = itemOffset + component * componentSize(accessor.componentType);
      if (accessor.componentType === COMPONENT_FLOAT) values.push(data.getFloat32(offset, true));
      else if (accessor.componentType === COMPONENT_UNSIGNED_SHORT) values.push(data.getUint16(offset, true));
      else values.push(data.getUint32(offset, true));
    }
  }

  return values;
}

function toVec3(values: number[]): AiVector3D[] {
  const output: AiVector3D[] = [];
  for (let index = 0; index < values.length; index += 3) {
    output.push({ x: values[index] ?? 0, y: values[index + 1] ?? 0, z: values[index + 2] ?? 0 });
  }
  return output;
}

function toUv(values: number[]): AiVector3D[] {
  const output: AiVector3D[] = [];
  for (let index = 0; index < values.length; index += 2) {
    output.push({ x: values[index] ?? 0, y: values[index + 1] ?? 0, z: 0 });
  }
  return output;
}

function createAabb(vertices: AiVector3D[]): AiAABB {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  vertices.forEach((vertex) => {
    min.x = Math.min(min.x, vertex.x);
    min.y = Math.min(min.y, vertex.y);
    min.z = Math.min(min.z, vertex.z);
    max.x = Math.max(max.x, vertex.x);
    max.y = Math.max(max.y, vertex.y);
    max.z = Math.max(max.z, vertex.z);
  });
  if (vertices.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }
  return { min, max };
}

function materialFromGltf(material: GltfMaterial | undefined, index: number): AiMaterial {
  const color = material?.pbrMetallicRoughness?.baseColorFactor ?? [0.8, 0.8, 0.8, 1];
  return {
    name: material?.name ?? `Material_${index}`,
    properties: [
      {
        key: "$clr.diffuse",
        semantic: AiTextureType.DIFFUSE,
        index: 0,
        type: AiPropertyTypeInfo.FLOAT,
        data: { r: color[0] ?? 0.8, g: color[1] ?? 0.8, b: color[2] ?? 0.8, a: color[3] ?? 1 },
      },
    ],
  };
}

function matrixFromNode(node: GltfNode): AiMatrix4x4 {
  if (node.matrix?.length === 16) {
    return { data: Float32Array.from(node.matrix) };
  }
  const matrix = createIdentityMatrix4x4();
  const translation = node.translation;
  if (translation) {
    matrix.data[12] = translation[0] ?? 0;
    matrix.data[13] = translation[1] ?? 0;
    matrix.data[14] = translation[2] ?? 0;
  }
  const scale = node.scale;
  if (scale) {
    matrix.data[0] = scale[0] ?? 1;
    matrix.data[5] = scale[1] ?? 1;
    matrix.data[10] = scale[2] ?? 1;
  }
  return matrix;
}

export class GltfImporter implements BaseImporter {
  canRead(buffer: ArrayBuffer, filename: string): boolean {
    const lower = filename.toLowerCase();
    return lower.endsWith(".glb") ? isGlb(buffer) : lower.endsWith(".gltf");
  }

  read(buffer: ArrayBuffer, filename: string, settings?: ImportSettings): ImportResult {
    const parsed = filename.toLowerCase().endsWith(".glb") || isGlb(buffer) ? readGlb(buffer) : { json: readJson(buffer), bin: new ArrayBuffer(0) };
    const asset = parsed.json;
    const bin = resolveBuffer(asset, parsed.bin, settings);
    const materials = (asset.materials ?? []).map(materialFromGltf);
    if (materials.length === 0) {
      materials.push(materialFromGltf(undefined, 0));
    }

    const meshes: AiMesh[] = [];
    const gltfMeshToAiMeshIndices = new Map<number, number[]>();
    asset.meshes?.forEach((mesh, meshIndex) => {
      const meshIndices: number[] = [];
      mesh.primitives.forEach((primitive, primitiveIndex) => {
        if ((primitive.mode ?? MODE_TRIANGLES) !== MODE_TRIANGLES) {
          return;
        }
        const positionAccessor = primitive.attributes.POSITION;
        if (positionAccessor === undefined) {
          return;
        }
        const positions = toVec3(readAccessorNumbers(asset, bin, positionAccessor));
        const normals = primitive.attributes.NORMAL !== undefined ? toVec3(readAccessorNumbers(asset, bin, primitive.attributes.NORMAL)) : [];
        const uvs = primitive.attributes.TEXCOORD_0 !== undefined ? toUv(readAccessorNumbers(asset, bin, primitive.attributes.TEXCOORD_0)) : null;
        const indices = primitive.indices !== undefined ? readAccessorNumbers(asset, bin, primitive.indices) : positions.map((_, index) => index);
        const faces = [];
        for (let index = 0; index < indices.length; index += 3) {
          faces.push({ indices: [indices[index] ?? 0, indices[index + 1] ?? 0, indices[index + 2] ?? 0] });
        }
        const aiMesh: AiMesh = {
          name: primitiveIndex === 0 ? (mesh.name ?? `Mesh_${meshIndex}`) : `${mesh.name ?? `Mesh_${meshIndex}`}_${primitiveIndex}`,
          primitiveTypes: AiPrimitiveType.TRIANGLE,
          vertices: positions,
          normals,
          tangents: [],
          bitangents: [],
          textureCoords: [uvs, null, null, null, null, null, null, null],
          colors: Array.from({ length: 8 }, () => null),
          faces,
          bones: [],
          materialIndex: primitive.material ?? 0,
          morphTargets: [],
          aabb: createAabb(positions),
        };
        meshIndices.push(meshes.length);
        meshes.push(aiMesh);
      });
      gltfMeshToAiMeshIndices.set(meshIndex, meshIndices);
    });

    const buildNode = (nodeIndex: number, parent: AiNode | null): AiNode => {
      const gltfNode = asset.nodes?.[nodeIndex] ?? {};
      const meshIndices = gltfNode.mesh !== undefined ? (gltfMeshToAiMeshIndices.get(gltfNode.mesh) ?? []) : [];
      const node: AiNode = {
        name: gltfNode.name ?? `Node_${nodeIndex}`,
        transformation: matrixFromNode(gltfNode),
        parent,
        children: [],
        meshIndices,
        metadata: {
          "gltf:nodeIndex": { type: AiMetadataType.INT32, data: nodeIndex },
        },
      };
      node.children = (gltfNode.children ?? []).map((child) => buildNode(child, node));
      return node;
    };

    const sceneNodeIndices = asset.scenes?.[asset.scene ?? 0]?.nodes ?? asset.nodes?.map((_, index) => index) ?? [];
    const rootNode: AiNode = {
      name: "Root",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: sceneNodeIndices.map((nodeIndex) => buildNode(nodeIndex, null)),
      meshIndices: [],
      metadata: null,
    };

    const scene: AiScene = {
      flags: AiSceneFlags.AI_SCENE_FLAGS_VALIDATED,
      rootNode,
      meshes,
      materials,
      animations: [],
      textures: [],
      lights: [],
      cameras: [],
      metadata: {
        "gltf:assetVersion": { type: AiMetadataType.AISTRING, data: asset.asset.version },
      },
    };
    return { scene, warnings: [] };
  }
}

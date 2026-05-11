import {
  AiPropertyTypeInfo,
  AiTextureType,
  type AiColor4D,
  type AiMaterial,
  type AiMatrix4x4,
  type AiMesh,
  type AiNode,
  type AiScene,
  type BaseExporter,
  type ExportSettings,
} from "@3d-nexus/core";
import { writeGlb } from "./glb";
import type { GltfAccessor, GltfAsset, GltfMaterial, GltfNode } from "./gltfTypes";

const COMPONENT_FLOAT = 5126;
const COMPONENT_UNSIGNED_INT = 5125;
const TARGET_ARRAY_BUFFER = 34962;
const TARGET_ELEMENT_ARRAY_BUFFER = 34963;
const MODE_TRIANGLES = 4;

interface BufferSlice {
  bufferView: number;
  byteOffset: number;
  byteLength: number;
}

function align4(length: number): number {
  return (4 - (length % 4)) % 4;
}

class BinaryBuilder {
  private chunks: Uint8Array[] = [];

  private length = 0;

  append(bytes: Uint8Array): BufferSlice {
    const padding = align4(this.length);
    if (padding > 0) {
      this.chunks.push(new Uint8Array(padding));
      this.length += padding;
    }
    const byteOffset = this.length;
    this.chunks.push(bytes);
    this.length += bytes.byteLength;
    return { bufferView: -1, byteOffset, byteLength: bytes.byteLength };
  }

  toArrayBuffer(): ArrayBuffer {
    const output = new Uint8Array(this.length);
    let offset = 0;
    this.chunks.forEach((chunk) => {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    });
    return output.buffer;
  }
}

function float32Bytes(values: number[]): Uint8Array {
  const array = new Float32Array(values);
  return new Uint8Array(array.buffer);
}

function uint32Bytes(values: number[]): Uint8Array {
  const array = new Uint32Array(values);
  return new Uint8Array(array.buffer);
}

function meshIndices(mesh: AiMesh): number[] {
  const output: number[] = [];
  mesh.faces.forEach((face) => {
    if (face.indices.length >= 3) {
      output.push(face.indices[0] ?? 0, face.indices[1] ?? 0, face.indices[2] ?? 0);
    }
  });
  return output.length > 0 ? output : mesh.vertices.map((_, index) => index);
}

function positionBounds(mesh: AiMesh): { min: number[]; max: number[] } {
  if (mesh.vertices.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }
  return {
    min: [mesh.aabb.min.x, mesh.aabb.min.y, mesh.aabb.min.z],
    max: [mesh.aabb.max.x, mesh.aabb.max.y, mesh.aabb.max.z],
  };
}

function diffuseColor(material: AiMaterial | undefined): AiColor4D | null {
  const property = material?.properties.find((item) => item.key === "$clr.diffuse" || item.semantic === AiTextureType.DIFFUSE);
  if (!property || property.type !== AiPropertyTypeInfo.FLOAT || typeof property.data !== "object" || property.data === null) {
    return null;
  }
  const data = property.data as Partial<AiColor4D>;
  return { r: data.r ?? 0.8, g: data.g ?? 0.8, b: data.b ?? 0.8, a: data.a ?? 1 };
}

function hasMatrixTransform(matrix: AiMatrix4x4): boolean {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  return identity.some((value, index) => Math.abs((matrix.data[index] ?? 0) - value) > 1e-6);
}

export class GltfExporter implements BaseExporter {
  private binContent = new ArrayBuffer(0);

  getSupportedExtensions(): string[] {
    return ["gltf", "glb"];
  }

  getBinContent(): ArrayBuffer {
    return this.binContent;
  }

  write(scene: AiScene, settings?: ExportSettings): ArrayBuffer {
    const builder = new BinaryBuilder();
    const bufferViews: NonNullable<GltfAsset["bufferViews"]> = [];
    const accessors: GltfAccessor[] = [];

    const addView = (bytes: Uint8Array, target: number): number => {
      const slice = builder.append(bytes);
      const index = bufferViews.length;
      bufferViews.push({ buffer: 0, byteOffset: slice.byteOffset, byteLength: slice.byteLength, target });
      return index;
    };

    const addAccessor = (
      bufferView: number,
      componentType: number,
      count: number,
      type: GltfAccessor["type"],
      bounds?: { min: number[]; max: number[] },
    ): number => {
      const index = accessors.length;
      const accessor: GltfAccessor = { bufferView, byteOffset: 0, componentType, count, type };
      if (bounds) {
        accessor.min = bounds.min;
        accessor.max = bounds.max;
      }
      accessors.push(accessor);
      return index;
    };

    const meshes = scene.meshes.map((mesh) => {
      const attributes: Record<string, number> = {};
      const positionValues = mesh.vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]);
      attributes.POSITION = addAccessor(
        addView(float32Bytes(positionValues), TARGET_ARRAY_BUFFER),
        COMPONENT_FLOAT,
        mesh.vertices.length,
        "VEC3",
        positionBounds(mesh),
      );

      if (mesh.normals.length === mesh.vertices.length) {
        const normalValues = mesh.normals.flatMap((normal) => [normal.x, normal.y, normal.z]);
        attributes.NORMAL = addAccessor(addView(float32Bytes(normalValues), TARGET_ARRAY_BUFFER), COMPONENT_FLOAT, mesh.normals.length, "VEC3");
      }

      const uv0 = mesh.textureCoords[0];
      if (uv0 && uv0.length === mesh.vertices.length) {
        const uvValues = uv0.flatMap((uv) => [uv.x, uv.y]);
        attributes.TEXCOORD_0 = addAccessor(addView(float32Bytes(uvValues), TARGET_ARRAY_BUFFER), COMPONENT_FLOAT, uv0.length, "VEC2");
      }

      const indices = meshIndices(mesh);
      const indexAccessor = addAccessor(addView(uint32Bytes(indices), TARGET_ELEMENT_ARRAY_BUFFER), COMPONENT_UNSIGNED_INT, indices.length, "SCALAR");
      return {
        name: mesh.name,
        primitives: [{ attributes, indices: indexAccessor, material: mesh.materialIndex, mode: MODE_TRIANGLES }],
      };
    });

    const materials: GltfMaterial[] = scene.materials.map((material) => {
      const color = diffuseColor(material);
      return {
        name: material.name,
        pbrMetallicRoughness: {
          baseColorFactor: color ? [color.r, color.g, color.b, color.a] : [0.8, 0.8, 0.8, 1],
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      };
    });

    if (materials.length === 0) {
      materials.push({ name: "DefaultMaterial", pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1], metallicFactor: 0, roughnessFactor: 1 } });
    }

    const nodes: GltfNode[] = [];
    const referencedMeshes = new Set<number>();
    const addMeshNode = (meshIndex: number, name?: string): number => {
      referencedMeshes.add(meshIndex);
      const index = nodes.length;
      nodes.push({ name: name ?? scene.meshes[meshIndex]?.name ?? `Mesh_${meshIndex}`, mesh: meshIndex });
      return index;
    };

    const addNode = (node: AiNode): number => {
      const children = node.children.map(addNode);
      if (node.meshIndices.length > 1) {
        children.push(...node.meshIndices.map((meshIndex) => addMeshNode(meshIndex)));
      }
      const gltfNode: GltfNode = { name: node.name };
      if (node.meshIndices.length === 1) {
        const meshIndex = node.meshIndices[0]!;
        gltfNode.mesh = meshIndex;
        referencedMeshes.add(meshIndex);
      }
      if (children.length > 0) {
        gltfNode.children = children;
      }
      if (hasMatrixTransform(node.transformation)) {
        gltfNode.matrix = Array.from(node.transformation.data);
      }
      const index = nodes.length;
      nodes.push(gltfNode);
      return index;
    };

    const rootNodes = scene.rootNode.children.map(addNode);
    scene.rootNode.meshIndices.forEach((meshIndex) => rootNodes.push(addMeshNode(meshIndex)));
    scene.meshes.forEach((_, meshIndex) => {
      if (!referencedMeshes.has(meshIndex)) {
        rootNodes.push(addMeshNode(meshIndex));
      }
    });

    this.binContent = builder.toArrayBuffer();
    const binFileName = typeof settings?.binFileName === "string" ? settings.binFileName : "scene.bin";
    const asGltf = settings?.format === "gltf";
    const asset: GltfAsset = {
      asset: { version: "2.0", generator: "3d-nexus" },
      scenes: [{ nodes: rootNodes }],
      scene: 0,
      nodes,
      meshes,
      materials,
      buffers: [asGltf ? { byteLength: this.binContent.byteLength, uri: binFileName } : { byteLength: this.binContent.byteLength }],
      bufferViews,
      accessors,
    };

    if (asGltf) {
      return new TextEncoder().encode(JSON.stringify(asset, null, 2)).buffer;
    }
    return writeGlb(asset, this.binContent);
  }
}

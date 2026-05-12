import {
  AiAnimInterpolation,
  AiPropertyTypeInfo,
  AiTextureType,
  type AiColor4D,
  type AiMaterialProperty,
  type AiMaterial,
  type AiMatrix4x4,
  type AiMesh,
  type AiMeshMorphAnim,
  type AiNode,
  type AiScene,
  type AiTexture,
  type BaseExporter,
  type ExportSettings,
} from "@3d-nexus/core";
import { writeGlb } from "./glb";
import type { GltfAccessor, GltfAnimation, GltfAsset, GltfImage, GltfMaterial, GltfNode, GltfSkin, GltfTexture } from "./gltfTypes";

const COMPONENT_FLOAT = 5126;
const COMPONENT_UNSIGNED_SHORT = 5123;
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

function uint16Bytes(values: number[]): Uint8Array {
  const array = new Uint16Array(values);
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

function vertexSkinData(mesh: AiMesh): { joints: number[]; weights: number[] } {
  const influences = Array.from({ length: mesh.vertices.length }, () => [] as Array<{ joint: number; weight: number }>);
  mesh.bones.forEach((bone, joint) => {
    bone.weights.forEach((weight) => {
      if (weight.vertexId >= 0 && weight.vertexId < influences.length && weight.weight > 0) {
        influences[weight.vertexId]!.push({ joint, weight: weight.weight });
      }
    });
  });

  const joints: number[] = [];
  const weights: number[] = [];
  influences.forEach((items) => {
    const selected = [...items].sort((left, right) => right.weight - left.weight).slice(0, 4);
    const total = selected.reduce((sum, item) => sum + item.weight, 0);
    for (let index = 0; index < 4; index += 1) {
      const item = selected[index];
      joints.push(item?.joint ?? 0);
      weights.push(item && total > 0 ? item.weight / total : 0);
    }
  });

  return { joints, weights };
}

function morphDeltas(base: Array<{ x: number; y: number; z: number }>, target: Array<{ x: number; y: number; z: number }>): number[] {
  return base.flatMap((value, index) => {
    const next = target[index] ?? value;
    return [next.x - value.x, next.y - value.y, next.z - value.z];
  });
}

function diffuseColor(material: AiMaterial | undefined): AiColor4D | null {
  const property = material?.properties.find((item) => item.key === "$clr.diffuse" || item.semantic === AiTextureType.DIFFUSE);
  if (!property || property.type !== AiPropertyTypeInfo.FLOAT || typeof property.data !== "object" || property.data === null) {
    return null;
  }
  const data = property.data as Partial<AiColor4D>;
  return { r: data.r ?? 0.8, g: data.g ?? 0.8, b: data.b ?? 0.8, a: data.a ?? 1 };
}

function materialProperty(material: AiMaterial | undefined, key: string, semantic?: AiTextureType): AiMaterialProperty | undefined {
  return material?.properties.find((property) => property.key === key && (semantic === undefined || property.semantic === semantic));
}

function numberMaterialProperty(material: AiMaterial | undefined, key: string): number | undefined {
  const property = materialProperty(material, key);
  return typeof property?.data === "number" ? property.data : undefined;
}

function textureMaterialProperty(material: AiMaterial | undefined, semantic: AiTextureType): string | null {
  const property = materialProperty(material, "$tex.file", semantic);
  return typeof property?.data === "string" && property.data.length > 0 ? property.data : null;
}

function mimeTypeForTexture(texture: AiTexture): string {
  const hint = texture.formatHint.toLowerCase();
  if (hint === "jpg" || hint === "jpeg") {
    return "image/jpeg";
  }
  if (hint === "webp") {
    return "image/webp";
  }
  return "image/png";
}

function hasMatrixTransform(matrix: AiMatrix4x4): boolean {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  return identity.some((value, index) => Math.abs((matrix.data[index] ?? 0) - value) > 1e-6);
}

function animationInterpolation(interpolation: AiAnimInterpolation | undefined): "LINEAR" | "STEP" | "CUBICSPLINE" {
  if (interpolation === AiAnimInterpolation.STEP) {
    return "STEP";
  }
  return "LINEAR";
}

function timeValues(keys: Array<{ time: number }>, ticksPerSecond: number): number[] {
  const divisor = ticksPerSecond > 0 ? ticksPerSecond : 1;
  return keys.map((key) => key.time / divisor);
}

function valueBounds(values: number[]): { min: number[]; max: number[] } {
  if (values.length === 0) {
    return { min: [0], max: [0] };
  }
  return { min: [Math.min(...values)], max: [Math.max(...values)] };
}

function uniqueSortedTimes(channels: Array<AiMeshMorphAnim | undefined>): number[] {
  return [...new Set(channels.flatMap((channel) => channel?.keys.map((key) => key.time) ?? []))].sort((left, right) => left - right);
}

function morphWeightAtTime(channel: AiMeshMorphAnim | undefined, time: number, fallback: number, targetIndex?: number): number {
  const key = channel?.keys.find((candidate) => candidate.time === time);
  if (!key) {
    return fallback;
  }
  if (targetIndex === undefined) {
    return key.weights[0] ?? fallback;
  }
  const valueIndex = key.values.findIndex((value) => Math.trunc(value) === targetIndex);
  return valueIndex >= 0 ? (key.weights[valueIndex] ?? fallback) : fallback;
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
    const images: GltfImage[] = [];
    const textures: GltfTexture[] = [];
    const textureLookup = new Map<string, number>();

    const addView = (bytes: Uint8Array, target?: number): number => {
      const slice = builder.append(bytes);
      const index = bufferViews.length;
      bufferViews.push(
        target === undefined
          ? { buffer: 0, byteOffset: slice.byteOffset, byteLength: slice.byteLength }
          : { buffer: 0, byteOffset: slice.byteOffset, byteLength: slice.byteLength, target },
      );
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

    const addTextureReference = (ref: string | null): number | undefined => {
      if (!ref) {
        return undefined;
      }
      const existing = textureLookup.get(ref);
      if (existing !== undefined) {
        return existing;
      }

      const imageIndex = images.length;
      if (ref.startsWith("*")) {
        const texture = scene.textures[Number(ref.slice(1))];
        if (!texture) {
          return undefined;
        }
        images.push({
          name: texture.filename,
          bufferView: addView(texture.data),
          mimeType: mimeTypeForTexture(texture),
        });
      } else {
        images.push({ uri: ref });
      }

      const textureIndex = textures.length;
      textures.push({ source: imageIndex });
      textureLookup.set(ref, textureIndex);
      return textureIndex;
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

      if (mesh.bones.length > 0) {
        const skinData = vertexSkinData(mesh);
        attributes.JOINTS_0 = addAccessor(addView(uint16Bytes(skinData.joints), TARGET_ARRAY_BUFFER), COMPONENT_UNSIGNED_SHORT, mesh.vertices.length, "VEC4");
        attributes.WEIGHTS_0 = addAccessor(addView(float32Bytes(skinData.weights), TARGET_ARRAY_BUFFER), COMPONENT_FLOAT, mesh.vertices.length, "VEC4");
      }

      const targets = mesh.morphTargets.map((morphTarget) => {
        const target: Record<string, number> = {};
        if (morphTarget.vertices.length === mesh.vertices.length) {
          target.POSITION = addAccessor(
            addView(float32Bytes(morphDeltas(mesh.vertices, morphTarget.vertices)), TARGET_ARRAY_BUFFER),
            COMPONENT_FLOAT,
            mesh.vertices.length,
            "VEC3",
          );
        }
        if (mesh.normals.length > 0 && morphTarget.normals.length === mesh.normals.length) {
          target.NORMAL = addAccessor(
            addView(float32Bytes(morphDeltas(mesh.normals, morphTarget.normals)), TARGET_ARRAY_BUFFER),
            COMPONENT_FLOAT,
            mesh.normals.length,
            "VEC3",
          );
        }
        return target;
      });

      const indices = meshIndices(mesh);
      const indexAccessor = addAccessor(addView(uint32Bytes(indices), TARGET_ELEMENT_ARRAY_BUFFER), COMPONENT_UNSIGNED_INT, indices.length, "SCALAR");
      const primitive = { attributes, indices: indexAccessor, material: mesh.materialIndex, mode: MODE_TRIANGLES };
      if (targets.length > 0) {
        Object.assign(primitive, { targets });
      }
      return {
        name: mesh.name,
        primitives: [primitive],
        ...(mesh.morphTargets.length > 0
          ? {
              weights: mesh.morphTargets.map((target) => target.weight ?? 0),
              extras: { targetNames: mesh.morphTargets.map((target) => target.name) },
            }
          : {}),
      };
    });

    const materials: GltfMaterial[] = scene.materials.map((material) => {
      const color = diffuseColor(material);
      const baseColorTexture = addTextureReference(
        textureMaterialProperty(material, AiTextureType.DIFFUSE) ?? textureMaterialProperty(material, AiTextureType.BASE_COLOR),
      );
      const normalTexture = addTextureReference(textureMaterialProperty(material, AiTextureType.NORMALS));
      const gltfMaterial: GltfMaterial = {
        name: material.name,
        pbrMetallicRoughness: {
          baseColorFactor: color ? [color.r, color.g, color.b, color.a] : [0.8, 0.8, 0.8, 1],
          metallicFactor: numberMaterialProperty(material, "$mat.metalness") ?? 0,
          roughnessFactor: numberMaterialProperty(material, "$mat.roughness") ?? 1,
        },
      };
      if (baseColorTexture !== undefined) {
        gltfMaterial.pbrMetallicRoughness!.baseColorTexture = { index: baseColorTexture };
      }
      if (normalTexture !== undefined) {
        gltfMaterial.normalTexture = { index: normalTexture };
      }
      return gltfMaterial;
    });

    if (materials.length === 0) {
      materials.push({ name: "DefaultMaterial", pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1], metallicFactor: 0, roughnessFactor: 1 } });
    }

    const nodes: GltfNode[] = [];
    const nodeIndexByName = new Map<string, number>();
    const meshNodeIndices = new Map<number, number[]>();
    const referencedMeshes = new Set<number>();
    const recordMeshNode = (meshIndex: number, nodeIndex: number): void => {
      const existing = meshNodeIndices.get(meshIndex) ?? [];
      existing.push(nodeIndex);
      meshNodeIndices.set(meshIndex, existing);
    };
    const addMeshNode = (meshIndex: number, name?: string): number => {
      referencedMeshes.add(meshIndex);
      const index = nodes.length;
      const nodeName = name ?? scene.meshes[meshIndex]?.name ?? `Mesh_${meshIndex}`;
      nodes.push({ name: nodeName, mesh: meshIndex });
      recordMeshNode(meshIndex, index);
      if (!nodeIndexByName.has(nodeName)) {
        nodeIndexByName.set(nodeName, index);
      }
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
      if (gltfNode.mesh !== undefined) {
        recordMeshNode(gltfNode.mesh, index);
      }
      if (!nodeIndexByName.has(node.name)) {
        nodeIndexByName.set(node.name, index);
      }
      return index;
    };

    const rootNodes = scene.rootNode.children.map(addNode);
    scene.rootNode.meshIndices.forEach((meshIndex) => rootNodes.push(addMeshNode(meshIndex)));
    scene.meshes.forEach((_, meshIndex) => {
      if (!referencedMeshes.has(meshIndex)) {
        rootNodes.push(addMeshNode(meshIndex));
      }
    });

    const ensureNodeByName = (name: string): number => {
      const existing = nodeIndexByName.get(name);
      if (existing !== undefined) {
        return existing;
      }
      const index = nodes.length;
      nodes.push({ name });
      nodeIndexByName.set(name, index);
      rootNodes.push(index);
      return index;
    };

    const skins: GltfSkin[] = [];
    scene.meshes.forEach((mesh, meshIndex) => {
      if (mesh.bones.length === 0) {
        return;
      }
      const joints = mesh.bones.map((bone) => ensureNodeByName(bone.node?.name ?? bone.name));
      const inverseBindValues = mesh.bones.flatMap((bone) => Array.from(bone.offsetMatrix.data));
      const inverseBindMatrices = addAccessor(addView(float32Bytes(inverseBindValues)), COMPONENT_FLOAT, mesh.bones.length, "MAT4");
      const skinIndex = skins.length;
      const skin: GltfSkin = { name: `${mesh.name || `Mesh_${meshIndex}`}_Skin`, joints, inverseBindMatrices };
      if (joints[0] !== undefined) {
        skin.skeleton = joints[0];
      }
      skins.push(skin);
      (meshNodeIndices.get(meshIndex) ?? []).forEach((nodeIndex) => {
        nodes[nodeIndex]!.skin = skinIndex;
      });
    });

    const animations: GltfAnimation[] = scene.animations
      .map((animation) => {
        const samplers: GltfAnimation["samplers"] = [];
        const channels: GltfAnimation["channels"] = [];
        const addChannel = (
          nodeName: string,
          path: "translation" | "rotation" | "scale",
          keys: Array<{ time: number; interpolation?: AiAnimInterpolation }>,
          values: number[],
          type: GltfAccessor["type"],
        ): void => {
          const nodeIndex = nodeIndexByName.get(nodeName);
          if (nodeIndex === undefined || keys.length === 0) {
            return;
          }
          const times = timeValues(keys, animation.ticksPerSecond);
          const input = addAccessor(addView(float32Bytes(times)), COMPONENT_FLOAT, times.length, "SCALAR", valueBounds(times));
          const output = addAccessor(addView(float32Bytes(values)), COMPONENT_FLOAT, keys.length, type);
          const sampler = samplers.length;
          samplers.push({ input, output, interpolation: animationInterpolation(keys[0]?.interpolation) });
          channels.push({ sampler, target: { node: nodeIndex, path } });
        };
        const addWeightsChannel = (nodeIndex: number, keyTimes: number[], values: number[]): void => {
          if (keyTimes.length === 0 || values.length === 0) {
            return;
          }
          const times = timeValues(
            keyTimes.map((time) => ({ time })),
            animation.ticksPerSecond,
          );
          const input = addAccessor(addView(float32Bytes(times)), COMPONENT_FLOAT, times.length, "SCALAR", valueBounds(times));
          const output = addAccessor(addView(float32Bytes(values)), COMPONENT_FLOAT, values.length, "SCALAR", valueBounds(values));
          const sampler = samplers.length;
          samplers.push({ input, output, interpolation: "LINEAR" });
          channels.push({ sampler, target: { node: nodeIndex, path: "weights" } });
        };

        animation.channels.forEach((channel) => {
          addChannel(
            channel.nodeName,
            "translation",
            channel.positionKeys,
            channel.positionKeys.flatMap((key) => [key.value.x, key.value.y, key.value.z]),
            "VEC3",
          );
          addChannel(
            channel.nodeName,
            "rotation",
            channel.rotationKeys,
            channel.rotationKeys.flatMap((key) => [key.value.x, key.value.y, key.value.z, key.value.w]),
            "VEC4",
          );
          addChannel(
            channel.nodeName,
            "scale",
            channel.scalingKeys,
            channel.scalingKeys.flatMap((key) => [key.value.x, key.value.y, key.value.z]),
            "VEC3",
          );
        });

        const morphChannels = new Map(animation.morphMeshChannels.map((channel) => [channel.name, channel]));
        scene.meshes.forEach((mesh, meshIndex) => {
          if (mesh.morphTargets.length === 0) {
            return;
          }
          const meshChannel = morphChannels.get(mesh.name);
          const targetChannels = mesh.morphTargets.map((target) => morphChannels.get(target.name));
          const keyTimes = uniqueSortedTimes([meshChannel, ...targetChannels]);
          const nodeIndex = meshNodeIndices.get(meshIndex)?.[0];
          if (nodeIndex === undefined || keyTimes.length === 0) {
            return;
          }
          const values = keyTimes.flatMap((time) =>
            mesh.morphTargets.map((target, targetIndex) => {
              const fallback = target.weight ?? 0;
              const targetChannel = targetChannels[targetIndex];
              return targetChannel ? morphWeightAtTime(targetChannel, time, fallback) : morphWeightAtTime(meshChannel, time, fallback, targetIndex);
            }),
          );
          addWeightsChannel(nodeIndex, keyTimes, values);
        });

        return { name: animation.name, samplers, channels };
      })
      .filter((animation) => animation.channels.length > 0);

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
    if (images.length > 0) {
      asset.images = images;
      asset.textures = textures;
    }
    if (skins.length > 0) {
      asset.skins = skins;
    }
    if (animations.length > 0) {
      asset.animations = animations;
    }

    if (asGltf) {
      return new TextEncoder().encode(JSON.stringify(asset, null, 2)).buffer;
    }
    return writeGlb(asset, this.binContent);
  }
}

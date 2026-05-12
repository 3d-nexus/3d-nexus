import {
  AiAnimBehaviour,
  AiAnimInterpolation,
  AiMetadataType,
  AiPrimitiveType,
  AiPropertyTypeInfo,
  AiSceneFlags,
  AiTextureType,
  createIdentityMatrix4x4,
  type AiAABB,
  type AiAnimMesh,
  type AiMeshMorphAnim,
  type AiBone,
  type AiMaterial,
  type AiMatrix4x4,
  type AiMesh,
  type AiNode,
  type AiQuaternion,
  type AiScene,
  type AiTexture,
  type AiVector3D,
  type AiAnimation,
  type BaseImporter,
  type ImportResult,
  type ImportSettings,
} from "@3d-nexus/core";
import { isGlb, readGlb } from "./glb";
import type { GltfAccessor, GltfAsset, GltfBufferView, GltfMaterial, GltfNode, GltfPrimitive } from "./gltfTypes";

const COMPONENT_FLOAT = 5126;
const COMPONENT_BYTE = 5120;
const COMPONENT_UNSIGNED_BYTE = 5121;
const COMPONENT_SHORT = 5122;
const COMPONENT_UNSIGNED_SHORT = 5123;
const COMPONENT_UNSIGNED_INT = 5125;
const MODE_TRIANGLES = 4;

function readJson(buffer: ArrayBuffer): GltfAsset {
  return JSON.parse(new TextDecoder().decode(buffer)) as GltfAsset;
}

function readDataUri(uri: string): { mimeType: string; buffer: ArrayBuffer } | null {
  const match = /^data:([^;,]+)?;base64,(.+)$/i.exec(uri);
  if (!match) {
    return null;
  }
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { mimeType: match[1] ?? "application/octet-stream", buffer: bytes.buffer };
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
      return dataUri.buffer;
    }
  }
  if (!buffer) {
    return new ArrayBuffer(0);
  }
  throw new Error("glTF input requires a GLB BIN chunk, data URI buffer, or settings.binBuffer");
}

function componentSize(componentType: number): number {
  if (componentType === COMPONENT_FLOAT || componentType === COMPONENT_UNSIGNED_INT) return 4;
  if (componentType === COMPONENT_SHORT || componentType === COMPONENT_UNSIGNED_SHORT) return 2;
  if (componentType === COMPONENT_BYTE || componentType === COMPONENT_UNSIGNED_BYTE) return 1;
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
      if (accessor.componentType === COMPONENT_FLOAT) {
        values.push(data.getFloat32(offset, true));
      } else if (accessor.componentType === COMPONENT_BYTE) {
        const value = data.getInt8(offset);
        values.push(accessor.normalized ? Math.max(value / 127, -1) : value);
      } else if (accessor.componentType === COMPONENT_UNSIGNED_BYTE) {
        const value = data.getUint8(offset);
        values.push(accessor.normalized ? value / 255 : value);
      } else if (accessor.componentType === COMPONENT_SHORT) {
        const value = data.getInt16(offset, true);
        values.push(accessor.normalized ? Math.max(value / 32767, -1) : value);
      } else if (accessor.componentType === COMPONENT_UNSIGNED_SHORT) {
        const value = data.getUint16(offset, true);
        values.push(accessor.normalized ? value / 65535 : value);
      } else {
        values.push(data.getUint32(offset, true));
      }
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

function matrixAt(values: number[], index: number): AiMatrix4x4 {
  const start = index * 16;
  if (values.length < start + 16) {
    return createIdentityMatrix4x4();
  }
  return { data: Float32Array.from(values.slice(start, start + 16)) };
}

function meshSkinLookup(asset: GltfAsset): Map<number, number> {
  const lookup = new Map<number, number>();
  asset.nodes?.forEach((node) => {
    if (node.mesh !== undefined && node.skin !== undefined && !lookup.has(node.mesh)) {
      lookup.set(node.mesh, node.skin);
    }
  });
  return lookup;
}

function meshWeightsLookup(asset: GltfAsset): Map<number, number[]> {
  const lookup = new Map<number, number[]>();
  asset.meshes?.forEach((mesh, meshIndex) => {
    if (mesh.weights) {
      lookup.set(meshIndex, mesh.weights);
    }
  });
  asset.nodes?.forEach((node) => {
    if (node.mesh !== undefined && node.weights && !lookup.has(node.mesh)) {
      lookup.set(node.mesh, node.weights);
    }
  });
  return lookup;
}

function bonesFromSkin(asset: GltfAsset, buffer: ArrayBuffer, skinIndex: number | undefined, primitive: GltfPrimitive): AiBone[] {
  if (skinIndex === undefined || primitive.attributes.JOINTS_0 === undefined || primitive.attributes.WEIGHTS_0 === undefined) {
    return [];
  }
  const skin = asset.skins?.[skinIndex];
  if (!skin) {
    return [];
  }

  const joints = readAccessorNumbers(asset, buffer, primitive.attributes.JOINTS_0);
  const weights = readAccessorNumbers(asset, buffer, primitive.attributes.WEIGHTS_0);
  const inverseBindMatrices = skin.inverseBindMatrices !== undefined ? readAccessorNumbers(asset, buffer, skin.inverseBindMatrices) : [];
  const bones = skin.joints.map<AiBone>((nodeIndex, jointIndex) => ({
    name: asset.nodes?.[nodeIndex]?.name ?? `Joint_${jointIndex}`,
    weights: [],
    offsetMatrix: matrixAt(inverseBindMatrices, jointIndex),
  }));

  const vertexCount = Math.min(joints.length, weights.length) / 4;
  for (let vertexId = 0; vertexId < vertexCount; vertexId += 1) {
    for (let component = 0; component < 4; component += 1) {
      const offset = vertexId * 4 + component;
      const jointIndex = Math.trunc(joints[offset] ?? 0);
      const weight = weights[offset] ?? 0;
      if (weight > 0 && bones[jointIndex]) {
        bones[jointIndex]!.weights.push({ vertexId, weight });
      }
    }
  }

  return bones.filter((bone) => bone.weights.length > 0);
}

function addVec3(base: AiVector3D[], deltas: number[] | null): AiVector3D[] {
  return base.map((value, index) => {
    const offset = index * 3;
    return {
      x: value.x + (deltas?.[offset] ?? 0),
      y: value.y + (deltas?.[offset + 1] ?? 0),
      z: value.z + (deltas?.[offset + 2] ?? 0),
    };
  });
}

function morphTargetsFromPrimitive(
  asset: GltfAsset,
  buffer: ArrayBuffer,
  primitive: GltfPrimitive,
  meshName: string,
  positions: AiVector3D[],
  normals: AiVector3D[],
  textureCoords: AiMesh["textureCoords"],
  weights: number[] | undefined,
  targetNames: string[] | undefined,
): AiAnimMesh[] {
  return (primitive.targets ?? []).map((target, targetIndex) => {
    const positionDeltas = target.POSITION !== undefined ? readAccessorNumbers(asset, buffer, target.POSITION) : null;
    const normalDeltas = target.NORMAL !== undefined && normals.length === positions.length ? readAccessorNumbers(asset, buffer, target.NORMAL) : null;
    return {
      name: targetNames?.[targetIndex] ?? `${meshName}_Morph_${targetIndex}`,
      vertices: addVec3(positions, positionDeltas),
      normals: normals.length === positions.length ? addVec3(normals, normalDeltas) : [],
      tangents: [],
      bitangents: [],
      colors: Array.from({ length: 8 }, () => null),
      textureCoords: textureCoords.map((channel) => channel?.map((uv) => ({ ...uv })) ?? null),
      weight: weights?.[targetIndex] ?? 0,
    };
  });
}

function sliceBufferView(asset: GltfAsset, buffer: ArrayBuffer, bufferViewIndex: number): ArrayBuffer {
  const view = asset.bufferViews?.[bufferViewIndex];
  if (!view) {
    throw new Error(`Invalid glTF bufferView: ${bufferViewIndex}`);
  }
  const byteOffset = view.byteOffset ?? 0;
  return buffer.slice(byteOffset, byteOffset + view.byteLength);
}

function formatHintFromMimeType(mimeType: string | undefined): string {
  if (!mimeType) {
    return "";
  }
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  return mimeType.split("/").pop() ?? "";
}

function collectTextures(asset: GltfAsset, buffer: ArrayBuffer): { textures: AiTexture[]; imageRefs: Map<number, string> } {
  const textures: AiTexture[] = [];
  const imageRefs = new Map<number, string>();

  asset.images?.forEach((image, imageIndex) => {
    if (typeof image.uri === "string") {
      const dataUri = readDataUri(image.uri);
      if (!dataUri) {
        imageRefs.set(imageIndex, image.uri);
        return;
      }
      const textureIndex = textures.length;
      textures.push({
        filename: image.name ?? `image_${imageIndex}.${formatHintFromMimeType(dataUri.mimeType)}`,
        width: 0,
        height: 0,
        formatHint: formatHintFromMimeType(dataUri.mimeType),
        data: new Uint8Array(dataUri.buffer),
      });
      imageRefs.set(imageIndex, `*${textureIndex}`);
      return;
    }

    if (image.bufferView !== undefined) {
      const textureIndex = textures.length;
      const data = sliceBufferView(asset, buffer, image.bufferView);
      textures.push({
        filename: image.name ?? `image_${imageIndex}.${formatHintFromMimeType(image.mimeType)}`,
        width: 0,
        height: 0,
        formatHint: formatHintFromMimeType(image.mimeType),
        data: new Uint8Array(data),
      });
      imageRefs.set(imageIndex, `*${textureIndex}`);
    }
  });

  return { textures, imageRefs };
}

function textureRef(asset: GltfAsset, textureIndex: number | undefined, imageRefs: Map<number, string>): string | null {
  if (textureIndex === undefined) {
    return null;
  }
  const texture = asset.textures?.[textureIndex];
  if (texture?.source === undefined) {
    return null;
  }
  return imageRefs.get(texture.source) ?? null;
}

function addNumberProperty(properties: AiMaterial["properties"], key: string, data: number): void {
  properties.push({ key, semantic: AiTextureType.NONE, index: 0, type: AiPropertyTypeInfo.FLOAT, data });
}

function addTextureProperty(properties: AiMaterial["properties"], semantic: AiTextureType, ref: string | null): void {
  if (!ref) {
    return;
  }
  properties.push({ key: "$tex.file", semantic, index: 0, type: AiPropertyTypeInfo.STRING, data: ref });
}

function materialFromGltf(material: GltfMaterial | undefined, index: number, asset: GltfAsset, imageRefs: Map<number, string>): AiMaterial {
  const color = material?.pbrMetallicRoughness?.baseColorFactor ?? [0.8, 0.8, 0.8, 1];
  const properties: AiMaterial["properties"] = [
    {
      key: "$clr.diffuse",
      semantic: AiTextureType.DIFFUSE,
      index: 0,
      type: AiPropertyTypeInfo.FLOAT,
      data: { r: color[0] ?? 0.8, g: color[1] ?? 0.8, b: color[2] ?? 0.8, a: color[3] ?? 1 },
    },
  ];

  if (material?.pbrMetallicRoughness?.metallicFactor !== undefined) {
    addNumberProperty(properties, "$mat.metalness", material.pbrMetallicRoughness.metallicFactor);
  }
  if (material?.pbrMetallicRoughness?.roughnessFactor !== undefined) {
    addNumberProperty(properties, "$mat.roughness", material.pbrMetallicRoughness.roughnessFactor);
  }
  addTextureProperty(properties, AiTextureType.DIFFUSE, textureRef(asset, material?.pbrMetallicRoughness?.baseColorTexture?.index, imageRefs));
  addTextureProperty(properties, AiTextureType.NORMALS, textureRef(asset, material?.normalTexture?.index, imageRefs));

  return {
    name: material?.name ?? `Material_${index}`,
    properties,
  };
}

function composeTrs(translation: number[] | undefined, rotation: number[] | undefined, scale: number[] | undefined): AiMatrix4x4 {
  const tx = translation?.[0] ?? 0;
  const ty = translation?.[1] ?? 0;
  const tz = translation?.[2] ?? 0;
  const sx = scale?.[0] ?? 1;
  const sy = scale?.[1] ?? 1;
  const sz = scale?.[2] ?? 1;
  const x = rotation?.[0] ?? 0;
  const y = rotation?.[1] ?? 0;
  const z = rotation?.[2] ?? 0;
  const w = rotation?.[3] ?? 1;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  return {
    data: new Float32Array([
      (1 - 2 * (yy + zz)) * sx,
      2 * (xy + wz) * sx,
      2 * (xz - wy) * sx,
      0,
      2 * (xy - wz) * sy,
      (1 - 2 * (xx + zz)) * sy,
      2 * (yz + wx) * sy,
      0,
      2 * (xz + wy) * sz,
      2 * (yz - wx) * sz,
      (1 - 2 * (xx + yy)) * sz,
      0,
      tx,
      ty,
      tz,
      1,
    ]),
  };
}

function matrixFromNode(node: GltfNode): AiMatrix4x4 {
  if (node.matrix?.length === 16) {
    return { data: Float32Array.from(node.matrix) };
  }
  return composeTrs(node.translation, node.rotation, node.scale);
}

function interpolationFromGltf(interpolation: string | undefined): AiAnimInterpolation {
  if (interpolation === "STEP") {
    return AiAnimInterpolation.STEP;
  }
  if (interpolation === "CUBICSPLINE") {
    return AiAnimInterpolation.CUBIC_SPLINE;
  }
  return AiAnimInterpolation.LINEAR;
}

function sampleAnimationValues(values: number[], keyCount: number, componentCount: number, interpolation: string | undefined): number[] {
  if (interpolation !== "CUBICSPLINE") {
    return values;
  }
  const output: number[] = [];
  for (let keyIndex = 0; keyIndex < keyCount; keyIndex += 1) {
    const valueOffset = (keyIndex * 3 + 1) * componentCount;
    for (let component = 0; component < componentCount; component += 1) {
      output.push(values[valueOffset + component] ?? 0);
    }
  }
  return output;
}

function toQuaternionKeys(
  times: number[],
  values: number[],
  interpolation: AiAnimInterpolation,
): Array<{ time: number; value: AiQuaternion; interpolation: AiAnimInterpolation }> {
  const keys = [];
  for (let index = 0; index < times.length; index += 1) {
    const offset = index * 4;
    keys.push({
      time: times[index] ?? 0,
      value: { x: values[offset] ?? 0, y: values[offset + 1] ?? 0, z: values[offset + 2] ?? 0, w: values[offset + 3] ?? 1 },
      interpolation,
    });
  }
  return keys;
}

function morphTargetNamesForMesh(mesh: NonNullable<GltfAsset["meshes"]>[number] | undefined, meshIndex: number): string[] {
  const primitiveTargetCount = Math.max(0, ...(mesh?.primitives ?? []).map((primitive) => primitive.targets?.length ?? 0));
  const count = Math.max(mesh?.extras?.targetNames?.length ?? 0, mesh?.weights?.length ?? 0, primitiveTargetCount);
  return Array.from(
    { length: count },
    (_, targetIndex) => mesh?.extras?.targetNames?.[targetIndex] ?? `${mesh?.name ?? `Mesh_${meshIndex}`}_Morph_${targetIndex}`,
  );
}

function animationsFromGltf(asset: GltfAsset, buffer: ArrayBuffer): AiAnimation[] {
  const nodeName = (nodeIndex: number): string => asset.nodes?.[nodeIndex]?.name ?? `Node_${nodeIndex}`;
  return (asset.animations ?? []).map((animation, animationIndex) => {
    const channels = new Map<string, NonNullable<AiAnimation["channels"][number]>>();
    const morphChannels = new Map<string, AiMeshMorphAnim>();
    let duration = 0;

    const channelForNode = (nodeIndex: number): AiAnimation["channels"][number] => {
      const name = nodeName(nodeIndex);
      const existing = channels.get(name);
      if (existing) {
        return existing;
      }
      const next: AiAnimation["channels"][number] = {
        nodeName: name,
        positionKeys: [],
        rotationKeys: [],
        scalingKeys: [],
        preState: AiAnimBehaviour.DEFAULT,
        postState: AiAnimBehaviour.DEFAULT,
      };
      channels.set(name, next);
      return next;
    };

    const morphChannelForName = (name: string): AiMeshMorphAnim => {
      const existing = morphChannels.get(name);
      if (existing) {
        return existing;
      }
      const next: AiMeshMorphAnim = { name, keys: [] };
      morphChannels.set(name, next);
      return next;
    };

    animation.channels.forEach((channel) => {
      const targetNode = channel.target.node;
      const sampler = animation.samplers[channel.sampler];
      if (targetNode === undefined || !sampler) {
        return;
      }
      const times = readAccessorNumbers(asset, buffer, sampler.input);
      const interpolation = interpolationFromGltf(sampler.interpolation);
      duration = Math.max(duration, ...times);

      if (channel.target.path === "weights") {
        const meshIndex = asset.nodes?.[targetNode]?.mesh;
        if (meshIndex === undefined) {
          return;
        }
        const targetNames = morphTargetNamesForMesh(asset.meshes?.[meshIndex], meshIndex);
        if (targetNames.length === 0) {
          return;
        }
        const values = sampleAnimationValues(readAccessorNumbers(asset, buffer, sampler.output), times.length, targetNames.length, sampler.interpolation);
        times.forEach((time, keyIndex) => {
          targetNames.forEach((targetName, targetIndex) => {
            morphChannelForName(targetName).keys.push({
              time,
              values: [0],
              weights: [values[keyIndex * targetNames.length + targetIndex] ?? 0],
            });
          });
        });
        return;
      }

      const targetChannel = channelForNode(targetNode);

      if (channel.target.path === "translation" || channel.target.path === "scale") {
        const values = sampleAnimationValues(readAccessorNumbers(asset, buffer, sampler.output), times.length, 3, sampler.interpolation);
        const keys = toVec3(values).map((value, index) => ({ time: times[index] ?? 0, value, interpolation }));
        if (channel.target.path === "translation") {
          targetChannel.positionKeys.push(...keys);
        } else {
          targetChannel.scalingKeys.push(...keys);
        }
      } else if (channel.target.path === "rotation") {
        const values = sampleAnimationValues(readAccessorNumbers(asset, buffer, sampler.output), times.length, 4, sampler.interpolation);
        targetChannel.rotationKeys.push(...toQuaternionKeys(times, values, interpolation));
      }
    });

    return {
      name: animation.name ?? `Animation_${animationIndex}`,
      duration,
      ticksPerSecond: 1,
      channels: [...channels.values()],
      meshChannels: [],
      morphMeshChannels: [...morphChannels.values()],
    };
  });
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
    const textureData = collectTextures(asset, bin);
    const meshSkins = meshSkinLookup(asset);
    const meshWeights = meshWeightsLookup(asset);
    const materials = (asset.materials ?? []).map((material, index) => materialFromGltf(material, index, asset, textureData.imageRefs));
    if (materials.length === 0) {
      materials.push(materialFromGltf(undefined, 0, asset, textureData.imageRefs));
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
        const textureCoords: AiMesh["textureCoords"] = [uvs, null, null, null, null, null, null, null];
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
          textureCoords,
          colors: Array.from({ length: 8 }, () => null),
          faces,
          bones: bonesFromSkin(asset, bin, meshSkins.get(meshIndex), primitive),
          materialIndex: primitive.material ?? 0,
          morphTargets: morphTargetsFromPrimitive(
            asset,
            bin,
            primitive,
            mesh.name ?? `Mesh_${meshIndex}`,
            positions,
            normals,
            textureCoords,
            meshWeights.get(meshIndex),
            mesh.extras?.targetNames,
          ),
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
    const nodesByName = new Map<string, AiNode>();
    const collectNodes = (node: AiNode): void => {
      nodesByName.set(node.name, node);
      node.children.forEach(collectNodes);
    };
    collectNodes(rootNode);
    meshes.forEach((mesh) => {
      mesh.bones.forEach((bone) => {
        bone.node = nodesByName.get(bone.name) ?? null;
      });
    });

    const scene: AiScene = {
      flags: AiSceneFlags.AI_SCENE_FLAGS_VALIDATED,
      rootNode,
      meshes,
      materials,
      animations: animationsFromGltf(asset, bin),
      textures: textureData.textures,
      lights: [],
      cameras: [],
      metadata: {
        "gltf:assetVersion": { type: AiMetadataType.AISTRING, data: asset.asset.version },
      },
    };
    return { scene, warnings: [] };
  }
}

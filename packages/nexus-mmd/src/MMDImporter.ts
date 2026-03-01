import {
  AiAnimBehaviour,
  AiMetadataType,
  AiPrimitiveType,
  AiPropertyTypeInfo,
  AiSceneFlags,
  AiTextureType,
  createIdentityMatrix4x4,
  type AiAnimation,
  type AiBone,
  type AiMesh,
  type AiMeshMorphAnim,
  type AiNode,
  type AiNodeAnim,
  type AiScene,
  type SdefCoeffs,
  type BaseImporter,
  type ImportResult,
  type ImportSettings,
} from "nexus-core";
import { MMDPmdParser } from "./MMDPmdParser";
import { MMDPmxParser, type PmxBone, type PmxDocument, type PmxVertex } from "./MMDPmxParser";
import { MMDVmdParser } from "./MMDVmdParser";

function startsWithText(buffer: ArrayBuffer, text: string): boolean {
  return new TextDecoder("ascii").decode(buffer.slice(0, text.length)) === text;
}

function buildBoneNodes(bones: PmxBone[]): AiNode[] {
  const nodes = bones.map<AiNode>((bone) => ({
    name: bone.name,
    transformation: createIdentityMatrix4x4(),
    parent: null,
    children: [],
    meshIndices: [],
    metadata: null,
  }));

  bones.forEach((bone, index) => {
    if (bone.parentIndex >= 0 && nodes[bone.parentIndex]) {
      nodes[index]!.parent = nodes[bone.parentIndex]!;
      nodes[bone.parentIndex]!.children.push(nodes[index]!);
    }
  });

  return nodes.filter((node) => node.parent === null);
}

type VertexWeightEntry = { boneIdx: number; weight: number };

function pushWeight(acc: Map<number, VertexWeightEntry[]>, vertexId: number, boneIdx: number, weight: number): void {
  if (boneIdx < 0 || weight <= 0) {
    return;
  }
  const entries = acc.get(vertexId) ?? [];
  entries.push({ boneIdx, weight });
  acc.set(vertexId, entries);
}

function extractWeights(
  vertex: PmxVertex,
  vertexId: number,
  acc: Map<number, VertexWeightEntry[]>,
  sdefByBone: Map<number, SdefCoeffs>,
  warnings: ImportResult["warnings"],
): void {
  const skinning = vertex.skinning as Record<string, unknown> | null;
  if (!skinning) {
    return;
  }

  if (vertex.skinningType === 0 && typeof skinning.boneIndex === "number") {
    pushWeight(acc, vertexId, skinning.boneIndex, 1);
    return;
  }

  if (vertex.skinningType === 1) {
    const weight = Number(skinning.weight ?? 1);
    pushWeight(acc, vertexId, Number(skinning.boneIndex1 ?? -1), weight);
    pushWeight(acc, vertexId, Number(skinning.boneIndex2 ?? -1), 1 - weight);
    return;
  }

  if (vertex.skinningType === 3) {
    const weight = Number(skinning.weight ?? 1);
    const boneIndex1 = Number(skinning.boneIndex1 ?? -1);
    const boneIndex2 = Number(skinning.boneIndex2 ?? -1);
    pushWeight(acc, vertexId, boneIndex1, weight);
    pushWeight(acc, vertexId, boneIndex2, 1 - weight);

    const coeffs: SdefCoeffs = {
      type: "sdef",
      c: {
        x: Number((skinning.c as number[] | undefined)?.[0] ?? 0),
        y: Number((skinning.c as number[] | undefined)?.[1] ?? 0),
        z: Number((skinning.c as number[] | undefined)?.[2] ?? 0),
      },
      r0: {
        x: Number((skinning.r0 as number[] | undefined)?.[0] ?? 0),
        y: Number((skinning.r0 as number[] | undefined)?.[1] ?? 0),
        z: Number((skinning.r0 as number[] | undefined)?.[2] ?? 0),
      },
      r1: {
        x: Number((skinning.r1 as number[] | undefined)?.[0] ?? 0),
        y: Number((skinning.r1 as number[] | undefined)?.[1] ?? 0),
        z: Number((skinning.r1 as number[] | undefined)?.[2] ?? 0),
      },
    };
    if (boneIndex1 >= 0) {
      sdefByBone.set(boneIndex1, coeffs);
    }

    const sum = weight + (1 - weight);
    if (Math.abs(sum - 1) > 0.01) {
      warnings.push({
        code: "PMX_WEIGHT_UNNORMALIZED",
        message: `Vertex ${vertexId} SDEF weights sum to ${sum}`,
      });
    }
    return;
  }

  if (vertex.skinningType === 2 || vertex.skinningType === 4) {
    const bones = Array.isArray(skinning.bones) ? skinning.bones : [];
    bones.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      pushWeight(
        acc,
        vertexId,
        Number((entry as { boneIndex?: number }).boneIndex ?? -1),
        Number((entry as { weight?: number }).weight ?? 0),
      );
    });
  }
}

export function buildPmxBones(document: PmxDocument, warnings: ImportResult["warnings"]): AiBone[] {
  const perVertex = new Map<number, VertexWeightEntry[]>();
  const sdefByBone = new Map<number, SdefCoeffs>();

  document.vertices.forEach((vertex, vertexId) => {
    extractWeights(vertex, vertexId, perVertex, sdefByBone, warnings);
  });

  const perBone = new Map<number, AiBone["weights"]>();
  perVertex.forEach((entries, vertexId) => {
    const filtered = entries.filter((entry) => entry.weight >= 1e-6);
    const sum = filtered.reduce((total, entry) => total + entry.weight, 0);
    if (sum <= 1e-6) {
      return;
    }

    filtered.forEach((entry) => {
      const weights = perBone.get(entry.boneIdx) ?? [];
      weights.push({ vertexId, weight: entry.weight / sum });
      perBone.set(entry.boneIdx, weights);
    });
  });

  return document.bones.map((bone, boneIdx) => ({
    name: bone.name,
    weights: perBone.get(boneIdx) ?? [],
    offsetMatrix: createIdentityMatrix4x4(),
    node: null,
    ikChain: sdefByBone.get(boneIdx),
  }));
}

function buildMorphTargets(document: PmxDocument, baseMesh: AiMesh): AiMesh["morphTargets"] {
  return document.morphs.flatMap((morph) => {
    if (morph.type === 1) {
      const overrides = new Map<number, number[]>();
      morph.offsets.forEach((offset) => {
        if (offset && typeof offset === "object" && "vertexIndex" in offset) {
          overrides.set(
            Number((offset as { vertexIndex: number }).vertexIndex),
            ((offset as { position?: number[] }).position ?? [0, 0, 0]).map(Number),
          );
        }
      });
      return [
        {
          name: morph.englishName || morph.name,
          vertices: baseMesh.vertices.map((vertex, index) => {
            const delta = overrides.get(index);
            return delta
              ? { x: vertex.x + delta[0]!, y: vertex.y + delta[1]!, z: vertex.z + delta[2]! }
              : { ...vertex };
          }),
          normals: [...baseMesh.normals],
          tangents: [],
          bitangents: [],
          colors: Array.from({ length: 8 }, () => null),
          textureCoords: baseMesh.textureCoords.map((channel) => channel?.map((value) => ({ ...value })) ?? null),
          weight: 0,
        },
      ];
    }

    if (morph.type === 3) {
      const overrides = new Map<number, number[]>();
      morph.offsets.forEach((offset) => {
        if (offset && typeof offset === "object" && "vertexIndex" in offset) {
          overrides.set(
            Number((offset as { vertexIndex: number }).vertexIndex),
            ((offset as { uv?: number[] }).uv ?? [0, 0, 0, 0]).map(Number),
          );
        }
      });
      return [
        {
          name: `UV:${morph.englishName || morph.name}`,
          vertices: baseMesh.vertices.map((vertex) => ({ ...vertex })),
          normals: [...baseMesh.normals],
          tangents: [],
          bitangents: [],
          colors: Array.from({ length: 8 }, () => null),
          textureCoords: baseMesh.textureCoords.map((channel, channelIndex) =>
            channelIndex === 0
              ? baseMesh.vertices.map((_, index) => {
                  const delta = overrides.get(index) ?? [0, 0, 0, 0];
                  return { x: delta[0] ?? 0, y: delta[1] ?? 0, z: delta[2] ?? 0 };
                })
              : channel?.map((value) => ({ ...value })) ?? null,
          ),
          weight: 0,
        },
      ];
    }

    return [];
  });
}

function collectMorphMetadata(document: PmxDocument) {
  const encode = (type: number, key: string, mapEntry: (morph: PmxDocument["morphs"][number]) => unknown) => {
    const items = document.morphs.filter((morph) => morph.type === type).map(mapEntry);
    return items.length > 0
      ? {
          [key]: {
            type: AiMetadataType.AISTRING,
            data: JSON.stringify(items),
          },
        }
      : {};
  };

  return {
    ...encode(2, "mmd:boneMorphs", (morph) => ({ name: morph.englishName || morph.name, entries: morph.offsets })),
    ...encode(8, "mmd:materialMorphs", (morph) => ({ name: morph.englishName || morph.name, entries: morph.offsets })),
    ...encode(0, "mmd:groupMorphs", (morph) => ({ name: morph.englishName || morph.name, entries: morph.offsets })),
  };
}

function sceneFromPmx(document: PmxDocument): ImportResult {
  const warnings: ImportResult["warnings"] = [];
  const children = buildBoneNodes(document.bones);
  const rootNode: AiNode = {
    name: document.modelName || "PMXRoot",
    transformation: createIdentityMatrix4x4(),
    parent: null,
    children,
    meshIndices: [0],
    metadata: null,
  };
  children.forEach((child) => {
    child.parent = rootNode;
  });

  const mesh: AiMesh = {
    name: document.modelName || "PMXMesh",
    primitiveTypes: AiPrimitiveType.TRIANGLE,
    vertices: document.vertices.map((vertex) => ({
      x: vertex.position[0],
      y: vertex.position[1],
      z: vertex.position[2],
    })),
    normals: document.vertices.map((vertex) => ({
      x: vertex.normal[0],
      y: vertex.normal[1],
      z: vertex.normal[2],
    })),
    tangents: [],
    bitangents: [],
    textureCoords: [
      document.vertices.map((vertex) => ({ x: vertex.uv[0], y: vertex.uv[1], z: 0 })),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    colors: Array.from({ length: 8 }, () => null),
    faces: Array.from({ length: document.indices.length / 3 }, (_, index) => ({
      indices: document.indices.slice(index * 3, index * 3 + 3),
    })),
    bones: buildPmxBones(document, warnings),
    materialIndex: 0,
    morphTargets: [],
    aabb: {
      min: {
        x: Math.min(...document.vertices.map((vertex) => vertex.position[0])),
        y: Math.min(...document.vertices.map((vertex) => vertex.position[1])),
        z: Math.min(...document.vertices.map((vertex) => vertex.position[2])),
      },
      max: {
        x: Math.max(...document.vertices.map((vertex) => vertex.position[0])),
        y: Math.max(...document.vertices.map((vertex) => vertex.position[1])),
        z: Math.max(...document.vertices.map((vertex) => vertex.position[2])),
      },
    },
  };
  mesh.morphTargets = buildMorphTargets(document, mesh);
  const metadata = {
    ...collectMorphMetadata(document),
  };
  if (document.rigidBodies.length > 0) {
    metadata["mmd:rigidBodies"] = {
      type: AiMetadataType.AISTRING,
      data: JSON.stringify(document.rigidBodies),
    };
  }
  if (document.joints.length > 0) {
    metadata["mmd:joints"] = {
      type: AiMetadataType.AISTRING,
      data: JSON.stringify(document.joints),
    };
  }

  return {
    scene: {
      flags: 0 as AiSceneFlags,
      rootNode,
      meshes: [mesh],
      materials: document.materials.map((material) => ({
        name: material.name,
        properties: [
          {
            key: "$clr.diffuse",
            semantic: AiTextureType.DIFFUSE,
            index: 0,
            type: AiPropertyTypeInfo.FLOAT,
            data: { r: material.diffuse[0], g: material.diffuse[1], b: material.diffuse[2], a: material.diffuse[3] },
          },
          {
            key: "$clr.specular",
            semantic: AiTextureType.SPECULAR,
            index: 0,
            type: AiPropertyTypeInfo.FLOAT,
            data: { r: material.specular[0], g: material.specular[1], b: material.specular[2], a: 1 },
          },
          {
            key: "$clr.ambient",
            semantic: AiTextureType.AMBIENT,
            index: 0,
            type: AiPropertyTypeInfo.FLOAT,
            data: { r: material.ambient[0], g: material.ambient[1], b: material.ambient[2], a: 1 },
          },
          {
            key: "$clr.edge",
            semantic: AiTextureType.NONE,
            index: 0,
            type: AiPropertyTypeInfo.FLOAT,
            data: { r: 0, g: 0, b: 0, a: 1 },
          },
          {
            key: "$tex.file",
            semantic: AiTextureType.DIFFUSE,
            index: 0,
            type: AiPropertyTypeInfo.STRING,
            data: document.textures[material.textureIndex] ?? "",
          },
        ],
      })),
      animations: [],
      textures: [],
      lights: [],
      cameras: [],
      metadata,
    },
    warnings,
  };
}

function mergeVmd(scene: AiScene, buffer: ArrayBuffer, warnings: ImportResult["warnings"]): void {
  const document = new MMDVmdParser().parse(buffer);
  const knownBoneNames = new Set<string>();
  const walk = (node: AiNode): void => {
    knownBoneNames.add(node.name);
    node.children.forEach(walk);
  };
  walk(scene.rootNode);

  const byName = new Map<string, AiNodeAnim>();
  const channels: AiNodeAnim[] = [];
  document.boneFrames.forEach((frame) => {
    if (!knownBoneNames.has(frame.name)) {
      warnings.push({ code: "VMD_BONE_NOT_FOUND", message: `VMD bone not found: ${frame.name}` });
      return;
    }

    let channel = byName.get(frame.name);
    if (!channel) {
      channel = {
        nodeName: frame.name,
        positionKeys: [],
        rotationKeys: [],
        scalingKeys: [],
        preState: AiAnimBehaviour.DEFAULT,
        postState: AiAnimBehaviour.DEFAULT,
      };
      byName.set(frame.name, channel);
      channels.push(channel);
    }

    channel.positionKeys.push({
      time: frame.frame,
      value: { x: frame.position[0]!, y: frame.position[1]!, z: frame.position[2]! },
      interpolation: {
        vmd: [frame.interpolation.x, frame.interpolation.y, frame.interpolation.z, frame.interpolation.r],
      } as never,
    });
    channel.rotationKeys.push({
      time: frame.frame,
      value: {
        x: frame.rotation[0]!,
        y: frame.rotation[1]!,
        z: frame.rotation[2]!,
        w: frame.rotation[3]!,
      },
      interpolation: {
        vmd: [frame.interpolation.x, frame.interpolation.y, frame.interpolation.z, frame.interpolation.r],
      } as never,
    });
  });

  const morphMeshChannels: AiMeshMorphAnim[] = document.morphFrames.map((frame) => ({
    name: frame.name,
    keys: [{ time: frame.frame, values: [0], weights: [frame.weight] }],
  }));

  const animation: AiAnimation = {
    name: document.modelName || "VMDAnimation",
    duration: Math.max(0, ...document.boneFrames.map((frame) => frame.frame)),
    ticksPerSecond: 30,
    channels,
    meshChannels: [],
    morphMeshChannels,
  };
  scene.animations.push(animation);
  if (document.cameraFrames.length > 0) {
    scene.metadata["mmd:cameraFrames"] = {
      type: AiMetadataType.AISTRING,
      data: JSON.stringify(
        document.cameraFrames.map((frame) => ({
          ...frame,
          interpolation: Array.from(frame.interpolation),
        })),
      ),
    };
  }
  if (document.ikFrames.length > 0) {
    scene.metadata["mmd:ikFrames"] = {
      type: AiMetadataType.AISTRING,
      data: JSON.stringify(document.ikFrames),
    };
  }
}

export class MMDImporter implements BaseImporter {
  canRead(buffer: ArrayBuffer, filename: string): boolean {
    const lower = filename.toLowerCase();
    return (
      lower.endsWith(".pmx") ||
      lower.endsWith(".pmd") ||
      lower.endsWith(".vmd") ||
      startsWithText(buffer, "PMX ") ||
      startsWithText(buffer, "Pmd") ||
      startsWithText(buffer, "Vocaloid Motion Data")
    );
  }

  read(buffer: ArrayBuffer, filename: string, settings?: ImportSettings): ImportResult {
    const warnings: ImportResult["warnings"] = [];
    let scene: AiScene;

    if (filename.toLowerCase().endsWith(".pmx") || startsWithText(buffer, "PMX ")) {
      const imported = sceneFromPmx(new MMDPmxParser().parse(buffer));
      scene = imported.scene;
      warnings.push(...imported.warnings);
    } else if (filename.toLowerCase().endsWith(".pmd") || startsWithText(buffer, "Pmd")) {
      const document = new MMDPmdParser().parse(buffer);
      scene = {
        flags: 0 as AiSceneFlags,
        rootNode: {
          name: document.header.modelName || "PMDRoot",
          transformation: createIdentityMatrix4x4(),
          parent: null,
          children: [],
          meshIndices: [0],
          metadata: null,
        },
        meshes: [],
        materials: [],
        animations: [],
        textures: [],
        lights: [],
        cameras: [],
        metadata: {},
      };
    } else {
      scene = {
        flags: 0 as AiSceneFlags,
        rootNode: {
          name: "VMDRoot",
          transformation: createIdentityMatrix4x4(),
          parent: null,
          children: [],
          meshIndices: [],
          metadata: null,
        },
        meshes: [],
        materials: [],
        animations: [],
        textures: [],
        lights: [],
        cameras: [],
        metadata: {},
      };
      mergeVmd(scene, buffer, warnings);
      return { scene, warnings };
    }

    if (settings?.motionBuffer) {
      mergeVmd(scene, settings.motionBuffer, warnings);
    }

    return { scene, warnings };
  }
}

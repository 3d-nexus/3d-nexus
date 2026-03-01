import {
  AiAnimBehaviour,
  AiMetadataType,
  AiPrimitiveType,
  AiPropertyTypeInfo,
  AiSceneFlags,
  AiTextureType,
  createIdentityMatrix4x4,
  type AiAnimation,
  type AiMeshMorphAnim,
  type AiNode,
  type AiNodeAnim,
  type AiScene,
  type BaseImporter,
  type ImportResult,
  type ImportSettings,
} from "nexus-core";
import { MMDPmdParser } from "./MMDPmdParser";
import { MMDPmxParser, type PmxBone, type PmxDocument } from "./MMDPmxParser";
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

function sceneFromPmx(document: PmxDocument): AiScene {
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

  return {
    flags: 0 as AiSceneFlags,
    rootNode,
    meshes: [
      {
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
        bones: document.bones.map((bone, index) => ({
          name: bone.name,
          weights: document.vertices.flatMap((vertex, vertexIndex) =>
            typeof vertex.skinning === "object" &&
            vertex.skinning !== null &&
            "boneIndex" in vertex.skinning &&
            (vertex.skinning as { boneIndex: number }).boneIndex === index
              ? [{ vertexId: vertexIndex, weight: 1 }]
              : [],
          ),
          offsetMatrix: createIdentityMatrix4x4(),
          node: null,
        })),
        materialIndex: 0,
        morphTargets: document.morphs
          .filter((morph) => morph.type === 1)
          .map((morph) => ({
            name: morph.name,
            vertices: document.vertices.map((vertex) => ({
              x: vertex.position[0],
              y: vertex.position[1],
              z: vertex.position[2],
            })),
            normals: [],
            tangents: [],
            bitangents: [],
            colors: Array.from({ length: 8 }, () => null),
            textureCoords: Array.from({ length: 8 }, () => null),
            weight: 0,
          })),
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
      },
    ],
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
    metadata: document.rigidBodies.length
      ? {
          "mmd:rigidBodies": {
            type: AiMetadataType.AISTRING,
            data: JSON.stringify(document.rigidBodies),
          },
        }
      : {},
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
    });
    channel.rotationKeys.push({
      time: frame.frame,
      value: {
        x: frame.rotation[0]!,
        y: frame.rotation[1]!,
        z: frame.rotation[2]!,
        w: frame.rotation[3]!,
      },
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
      scene = sceneFromPmx(new MMDPmxParser().parse(buffer));
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

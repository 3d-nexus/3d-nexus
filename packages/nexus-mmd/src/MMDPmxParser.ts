import { BinaryReader } from "./BinaryReader";

const PMX_SOFT_BODY_VERSION_THRESHOLD = 2.099;

export interface PmxSetting {
  version: number;
  encoding: number;
  additionalUvCount: number;
  vertexIndexSize: number;
  textureIndexSize: number;
  materialIndexSize: number;
  boneIndexSize: number;
  morphIndexSize: number;
  rigidBodyIndexSize: number;
}

export interface PmxVertex {
  position: [number, number, number];
  normal: [number, number, number];
  uv: [number, number];
  additionalUvs: number[][];
  skinningType: number;
  skinning: unknown;
  edgeScale: number;
}

export interface PmxMaterial {
  name: string;
  englishName: string;
  diffuse: number[];
  specular: number[];
  shininess: number;
  ambient: number[];
  flags: number;
  edgeColor: number[];
  edgeSize: number;
  textureIndex: number;
  sphereTextureIndex: number;
  sphereMode: number;
  toonSharingFlag: number;
  toonIndex: number;
  memo: string;
  faceVertexCount: number;
}

export interface PmxBone {
  name: string;
  englishName: string;
  position: [number, number, number];
  parentIndex: number;
  layer: number;
  flags: number;
  tailBoneIndex?: number;
  tailOffset?: number[];
  inheritBoneIndex?: number;
  inheritWeight?: number;
  fixedAxis?: number[];
  localAxisX?: number[];
  localAxisZ?: number[];
  externalParentKey?: number;
  ik?: {
    targetBoneIndex: number;
    loopCount: number;
    limitRadian: number;
    links: Array<{ boneIndex: number; hasLimits: boolean; min?: number[]; max?: number[] }>;
  };
}

export interface PmxDisplayFrame {
  name: string;
  englishName: string;
  specialFlag: number;
  elements: Array<{ type: number; index: number }>;
}

export interface PmxMorph {
  name: string;
  englishName: string;
  panel: number;
  type: number;
  offsets: unknown[];
}

export interface PmxRigidBody {
  name: string;
  englishName?: string;
  boneIndex: number;
  groupIndex?: number;
  nonCollisionMask?: number;
  shape?: number;
  size?: number[];
  position?: number[];
  rotation?: number[];
  mass?: number;
  translateDamping?: number;
  rotateDamping?: number;
  repulsion?: number;
  friction?: number;
  physicsMode?: number;
}

export interface PmxJoint {
  name: string;
  englishName?: string;
  type: number;
  rigidBodyA: number;
  rigidBodyB: number;
  position: number[];
  rotation: number[];
  limitPositionMin: number[];
  limitPositionMax: number[];
  limitRotationMin: number[];
  limitRotationMax: number[];
  springPosition: number[];
  springRotation: number[];
}

export interface PmxDocument {
  setting: PmxSetting;
  modelName: string;
  englishModelName: string;
  comment: string;
  englishComment: string;
  vertices: PmxVertex[];
  indices: number[];
  textures: string[];
  materials: PmxMaterial[];
  bones: PmxBone[];
  morphs: PmxMorph[];
  rigidBodies: PmxRigidBody[];
  joints: PmxJoint[];
  displayFrames: PmxDisplayFrame[];
  softBodies: Array<{ name: string; englishName: string }>;
}

function readVector(reader: BinaryReader, size: number): number[] {
  return Array.from({ length: size }, () => reader.readFloat32());
}

export class MMDPmxParser {
  parse(buffer: ArrayBuffer): PmxDocument {
    const reader = new BinaryReader(buffer);
    const magic = reader.readString(4, "ascii");
    if (magic !== "PMX ") {
      throw new Error("Invalid PMX magic");
    }

    const version = reader.readFloat32();
    const headerSize = reader.readUint8();
    const header = Array.from({ length: headerSize }, () => reader.readUint8());
    const setting: PmxSetting = {
      version,
      encoding: header[0] ?? 1,
      additionalUvCount: header[1] ?? 0,
      vertexIndexSize: header[2] ?? 4,
      textureIndexSize: header[3] ?? 4,
      materialIndexSize: header[4] ?? 4,
      boneIndexSize: header[5] ?? 4,
      morphIndexSize: header[6] ?? 4,
      rigidBodyIndexSize: header[7] ?? 4,
    };
    const encoding = setting.encoding === 0 ? "utf-16le" : "utf-8";

    const modelName = reader.readTextBuffer(encoding);
    const englishModelName = reader.readTextBuffer(encoding);
    const comment = reader.readTextBuffer(encoding);
    const englishComment = reader.readTextBuffer(encoding);

    const vertexCount = reader.readUint32();
    const vertices: PmxVertex[] = [];
    for (let index = 0; index < vertexCount; index += 1) {
      const position = readVector(reader, 3) as [number, number, number];
      const normal = readVector(reader, 3) as [number, number, number];
      const uv = readVector(reader, 2) as [number, number];
      const additionalUvs = Array.from({ length: setting.additionalUvCount }, () => readVector(reader, 4));
      const skinningType = reader.readUint8();
      let skinning: unknown;
      switch (skinningType) {
        case 0:
          skinning = { boneIndex: reader.readIndex(setting.boneIndexSize), weight: 1 };
          break;
        case 1:
          skinning = {
            boneIndex1: reader.readIndex(setting.boneIndexSize),
            boneIndex2: reader.readIndex(setting.boneIndexSize),
            weight: reader.readFloat32(),
          };
          break;
        case 2:
        case 4:
          skinning = {
            bones: Array.from({ length: 4 }, () => ({
              boneIndex: reader.readIndex(setting.boneIndexSize),
              weight: 0,
            })),
          };
          (skinning as { bones: Array<{ boneIndex: number; weight: number }> }).bones.forEach((entry) => {
            entry.weight = reader.readFloat32();
          });
          break;
        case 3:
          skinning = {
            boneIndex1: reader.readIndex(setting.boneIndexSize),
            boneIndex2: reader.readIndex(setting.boneIndexSize),
            weight: reader.readFloat32(),
            c: readVector(reader, 3),
            r0: readVector(reader, 3),
            r1: readVector(reader, 3),
          };
          break;
        default:
          throw new Error(`Unsupported PMX skinning type: ${skinningType}`);
      }

      vertices.push({
        position,
        normal,
        uv,
        additionalUvs,
        skinningType,
        skinning,
        edgeScale: reader.readFloat32(),
      });
    }

    const indexCount = reader.readUint32();
    const indices = Array.from({ length: indexCount }, () => reader.readIndex(setting.vertexIndexSize, false));
    const textureCount = reader.readUint32();
    const textures = Array.from({ length: textureCount }, () => reader.readTextBuffer(encoding));

    const materialCount = reader.readUint32();
    const materials: PmxMaterial[] = [];
    for (let index = 0; index < materialCount; index += 1) {
      const name = reader.readTextBuffer(encoding);
      const englishName = reader.readTextBuffer(encoding);
      const diffuse = readVector(reader, 4);
      const specular = readVector(reader, 3);
      const shininess = reader.readFloat32();
      const ambient = readVector(reader, 3);
      const flags = reader.readUint8();
      const edgeColor = readVector(reader, 4);
      const edgeSize = reader.readFloat32();
      const materialStart = reader.position;
      let textureIndex = reader.readIndex(setting.textureIndexSize);
      let sphereTextureIndex = reader.readIndex(setting.textureIndexSize);
      let sphereMode = reader.readUint8();
      let toonSharingFlag = reader.readUint8();
      let toonIndex = toonSharingFlag === 0 ? reader.readIndex(setting.textureIndexSize) : reader.readUint8();
      let memo = "";
      let faceVertexCount = 0;
      const memoLength = reader.readInt32();
      const remainingAfterMemo = buffer.byteLength - reader.position;
      const looksLikeSpecLayout = memoLength >= 0 && memoLength <= remainingAfterMemo;
      if (looksLikeSpecLayout) {
        memo = reader.readString(memoLength, encoding);
        faceVertexCount = reader.readInt32();
      } else {
        reader.position = materialStart;
        reader.readUint8();
        textureIndex = reader.readIndex(setting.textureIndexSize);
        sphereTextureIndex = reader.readIndex(setting.textureIndexSize);
        sphereMode = reader.readUint8();
        toonSharingFlag = 1;
        toonIndex = reader.readUint8();
        reader.readInt32();
        memo = "";
        faceVertexCount = reader.readInt32();
      }
      materials.push({
        name,
        englishName,
        diffuse,
        specular,
        shininess,
        ambient,
        flags,
        edgeColor,
        edgeSize,
        textureIndex,
        sphereTextureIndex,
        sphereMode,
        toonSharingFlag,
        toonIndex,
        memo,
        faceVertexCount,
      });
    }

    const boneCount = reader.readUint32();
    const bones: PmxBone[] = [];
    for (let index = 0; index < boneCount; index += 1) {
      const name = reader.readTextBuffer(encoding);
      const englishName = reader.readTextBuffer(encoding);
      const position = readVector(reader, 3) as [number, number, number];
      const parentIndex = reader.readIndex(setting.boneIndexSize);
      const layer = reader.readInt32();
      const flags = reader.readUint16();
      const bone: PmxBone = { name, englishName, position, parentIndex, layer, flags };
      if ((flags & 0x0001) !== 0) {
        bone.tailBoneIndex = reader.readIndex(setting.boneIndexSize);
      } else {
        bone.tailOffset = readVector(reader, 3);
      }
      if ((flags & 0x0100) !== 0 || (flags & 0x0200) !== 0) {
        bone.inheritBoneIndex = reader.readIndex(setting.boneIndexSize);
        bone.inheritWeight = reader.readFloat32();
      }
      if ((flags & 0x0400) !== 0) {
        bone.fixedAxis = readVector(reader, 3);
      }
      if ((flags & 0x0800) !== 0) {
        bone.localAxisX = readVector(reader, 3);
        bone.localAxisZ = readVector(reader, 3);
      }
      if ((flags & 0x2000) !== 0) {
        bone.externalParentKey = reader.readInt32();
      }
      if ((flags & 0x0020) !== 0) {
        const targetBoneIndex = reader.readIndex(setting.boneIndexSize);
        const loopCount = reader.readInt32();
        const limitRadian = reader.readFloat32();
        const linkCount = reader.readInt32();
        bone.ik = {
          targetBoneIndex,
          loopCount,
          limitRadian,
          links: Array.from({ length: linkCount }, () => {
            const boneIndex = reader.readIndex(setting.boneIndexSize);
            const hasLimits = reader.readUint8() !== 0;
            const link: { boneIndex: number; hasLimits: boolean; min?: number[]; max?: number[] } = {
              boneIndex,
              hasLimits,
            };
            if (hasLimits) {
              link.min = readVector(reader, 3);
              link.max = readVector(reader, 3);
            }
            return link;
          }),
        };
      }
      bones.push(bone);
    }

    const morphCount = reader.readUint32();
    const morphs: PmxMorph[] = [];
    for (let index = 0; index < morphCount; index += 1) {
      const name = reader.readTextBuffer(encoding);
      const englishName = reader.readTextBuffer(encoding);
      const panel = reader.readUint8();
      const type = reader.readUint8();
      const offsetCount = reader.readInt32();
      const offsets = [];
      for (let offsetIndex = 0; offsetIndex < offsetCount; offsetIndex += 1) {
        if (type === 1) {
          offsets.push({
            vertexIndex: reader.readIndex(setting.vertexIndexSize, false),
            position: readVector(reader, 3),
          });
        } else if (type === 3) {
          offsets.push({
            vertexIndex: reader.readIndex(setting.vertexIndexSize, false),
            uv: readVector(reader, 4),
          });
        } else if (type === 2) {
          offsets.push({
            boneIndex: reader.readIndex(setting.boneIndexSize),
            translation: readVector(reader, 3),
            rotation: readVector(reader, 4),
          });
        } else if (type === 8) {
          offsets.push({
            materialIndex: reader.readIndex(setting.materialIndexSize),
            operation: reader.readUint8(),
            diffuse: readVector(reader, 4),
            specular: readVector(reader, 3),
            shininess: reader.readFloat32(),
            ambient: readVector(reader, 3),
            edge: readVector(reader, 4),
            edgeSize: reader.readFloat32(),
            texture: readVector(reader, 4),
            sphereTexture: readVector(reader, 4),
            toon: readVector(reader, 4),
          });
        } else if (type === 0) {
          offsets.push({
            morphIndex: reader.readIndex(setting.morphIndexSize),
            weight: reader.readFloat32(),
          });
        }
      }
      morphs.push({ name, englishName, panel, type, offsets });
    }

    const frameCount = reader.readUint32();
    const displayFrames: PmxDisplayFrame[] = [];
    for (let index = 0; index < frameCount; index += 1) {
      const name = reader.readTextBuffer(encoding);
      const englishName = reader.readTextBuffer(encoding);
      const specialFlag = reader.readUint8();
      const elementCount = reader.readInt32();
      const elements: Array<{ type: number; index: number }> = [];
      for (let elementIndex = 0; elementIndex < elementCount; elementIndex += 1) {
        const elementType = reader.readUint8();
        elements.push({
          type: elementType,
          index: reader.readIndex(elementType === 0 ? setting.boneIndexSize : setting.morphIndexSize),
        });
      }
      displayFrames.push({ name, englishName, specialFlag, elements });
    }

    const rigidBodyCount = reader.readUint32();
    const rigidBodies: PmxRigidBody[] = [];
    for (let index = 0; index < rigidBodyCount; index += 1) {
      const name = reader.readTextBuffer(encoding);
      const englishName = reader.readTextBuffer(encoding);
      const boneIndex = reader.readIndex(setting.boneIndexSize);
      const groupIndex = reader.readUint8();
      const nonCollisionMask = reader.readUint16();
      const shape = reader.readUint8();
      const size = readVector(reader, 3);
      const position = readVector(reader, 3);
      const rotation = readVector(reader, 3);
      const mass = reader.readFloat32();
      const translateDamping = reader.readFloat32();
      const rotateDamping = reader.readFloat32();
      const repulsion = reader.readFloat32();
      const friction = reader.readFloat32();
      const physicsMode = reader.readUint8();
      rigidBodies.push({
        name,
        englishName,
        boneIndex,
        groupIndex,
        nonCollisionMask,
        shape,
        size,
        position,
        rotation,
        mass,
        translateDamping,
        rotateDamping,
        repulsion,
        friction,
        physicsMode,
      });
    }

    const jointCount = reader.readUint32();
    const joints: PmxJoint[] = [];
    for (let index = 0; index < jointCount; index += 1) {
      const name = reader.readTextBuffer(encoding);
      const englishName = reader.readTextBuffer(encoding);
      const type = reader.readUint8();
      const rigidBodyA = reader.readIndex(setting.rigidBodyIndexSize);
      const rigidBodyB = reader.readIndex(setting.rigidBodyIndexSize);
      const position = readVector(reader, 3);
      const rotation = readVector(reader, 3);
      const limitPositionMin = readVector(reader, 3);
      const limitPositionMax = readVector(reader, 3);
      const limitRotationMin = readVector(reader, 3);
      const limitRotationMax = readVector(reader, 3);
      const springPosition = readVector(reader, 3);
      const springRotation = readVector(reader, 3);
      joints.push({
        name,
        englishName,
        type,
        rigidBodyA,
        rigidBodyB,
        position,
        rotation,
        limitPositionMin,
        limitPositionMax,
        limitRotationMin,
        limitRotationMax,
        springPosition,
        springRotation,
      });
    }

    const softBodies: Array<{ name: string; englishName: string }> = [];
    if (setting.version >= PMX_SOFT_BODY_VERSION_THRESHOLD && reader.position < buffer.byteLength) {
      const softBodyCount = reader.readUint32();
      for (let index = 0; index < softBodyCount; index += 1) {
        const name = reader.readTextBuffer(encoding);
        const englishName = reader.readTextBuffer(encoding);
        softBodies.push({ name, englishName });
      }
    }

    return {
      setting,
      modelName,
      englishModelName,
      comment,
      englishComment,
      vertices,
      indices,
      textures,
      materials,
      bones,
      morphs,
      rigidBodies,
      joints,
      displayFrames,
      softBodies,
    };
  }
}

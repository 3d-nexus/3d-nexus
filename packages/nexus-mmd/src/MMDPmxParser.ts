import { BinaryReader } from "./BinaryReader";

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
  textureIndex: number;
  faceVertexCount: number;
}

export interface PmxBone {
  name: string;
  englishName: string;
  position: [number, number, number];
  parentIndex: number;
  layer: number;
  flags: number;
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
  boneIndex: number;
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
              weight: reader.readFloat32(),
            })),
          };
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
      reader.readUint8();
      readVector(reader, 5);
      reader.readUint8();
      const textureIndex = reader.readIndex(setting.textureIndexSize);
      reader.readIndex(setting.textureIndexSize);
      reader.readUint8();
      reader.readUint8();
      reader.readInt32();
      const faceVertexCount = reader.readInt32();
      materials.push({
        name,
        englishName,
        diffuse,
        specular,
        shininess,
        ambient,
        textureIndex,
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
      if ((flags & 0x0001) !== 0) {
        reader.readIndex(setting.boneIndexSize);
      } else {
        readVector(reader, 3);
      }
      bones.push({ name, englishName, position, parentIndex, layer, flags });
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
        }
      }
      morphs.push({ name, englishName, panel, type, offsets });
    }

    const frameCount = reader.readUint32();
    for (let index = 0; index < frameCount; index += 1) {
      reader.readTextBuffer(encoding);
      reader.readTextBuffer(encoding);
      reader.readUint8();
      const elementCount = reader.readInt32();
      for (let elementIndex = 0; elementIndex < elementCount; elementIndex += 1) {
        const elementType = reader.readUint8();
        reader.readIndex(elementType === 0 ? setting.boneIndexSize : setting.morphIndexSize);
      }
    }

    const rigidBodyCount = reader.readUint32();
    const rigidBodies: PmxRigidBody[] = [];
    for (let index = 0; index < rigidBodyCount; index += 1) {
      const name = reader.readTextBuffer(encoding);
      reader.readTextBuffer(encoding);
      const boneIndex = reader.readIndex(setting.boneIndexSize);
      reader.readUint8();
      reader.readUint16();
      reader.readUint8();
      readVector(reader, 14);
      reader.readUint8();
      rigidBodies.push({ name, boneIndex });
    }

    const jointCount = reader.readUint32();
    for (let index = 0; index < jointCount; index += 1) {
      reader.readTextBuffer(encoding);
      reader.readTextBuffer(encoding);
      reader.readUint8();
      reader.readIndex(setting.rigidBodyIndexSize);
      reader.readIndex(setting.rigidBodyIndexSize);
      readVector(reader, 24);
    }

    if (setting.version >= 2.1 && reader.position < buffer.byteLength) {
      const softBodyCount = reader.readUint32();
      for (let index = 0; index < softBodyCount; index += 1) {
        reader.readTextBuffer(encoding);
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
    };
  }
}

import { BinaryReader } from "./BinaryReader";

export interface PmdHeader {
  version: number;
  modelName: string;
  comment: string;
}

export interface PmdVertex {
  position: number[];
  normal: number[];
  uv: number[];
  boneIndices: number[];
  boneWeight: number;
}

export interface PmdMaterial {
  diffuse: number[];
  shininess: number;
  specular: number[];
  ambient: number[];
  faceVertexCount: number;
  textureFileName: string;
}

export interface PmdBone {
  name: string;
  parentIndex: number;
  position: number[];
}

export interface PmdIk {
  boneIndex: number;
  targetBoneIndex: number;
  chainLength: number;
}

export interface PmdMorph {
  name: string;
  vertexCount: number;
}

export interface PmdDocument {
  header: PmdHeader;
  vertices: PmdVertex[];
  indices: number[];
  materials: PmdMaterial[];
  bones: PmdBone[];
  ikChains: PmdIk[];
  morphs: PmdMorph[];
}

function decodeShiftJis(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  const slice = end >= 0 ? bytes.subarray(0, end) : bytes;
  try {
    return new TextDecoder("shift-jis").decode(slice);
  } catch {
    return new TextDecoder("utf-8").decode(slice);
  }
}

export class MMDPmdParser {
  parse(buffer: ArrayBuffer): PmdDocument {
    const reader = new BinaryReader(buffer);
    const magic = reader.readString(3, "ascii");
    if (magic !== "Pmd") {
      throw new Error("Invalid PMD magic");
    }

    const version = reader.readFloat32();
    const modelName = decodeShiftJis(reader.readBytes(20));
    const comment = decodeShiftJis(reader.readBytes(256));
    const vertexCount = reader.readUint32();
    const vertices: PmdVertex[] = [];
    for (let index = 0; index < vertexCount; index += 1) {
      vertices.push({
        position: [reader.readFloat32(), reader.readFloat32(), reader.readFloat32()],
        normal: [reader.readFloat32(), reader.readFloat32(), reader.readFloat32()],
        uv: [reader.readFloat32(), reader.readFloat32()],
        boneIndices: [reader.readUint16(), reader.readUint16()],
        boneWeight: reader.readUint8(),
      });
      reader.readUint8();
    }

    const indexCount = reader.readUint32();
    const indices = Array.from({ length: indexCount }, () => reader.readUint16());
    const materialCount = reader.readUint32();
    const materials: PmdMaterial[] = [];
    for (let index = 0; index < materialCount; index += 1) {
      materials.push({
        diffuse: [reader.readFloat32(), reader.readFloat32(), reader.readFloat32(), reader.readFloat32()],
        shininess: reader.readFloat32(),
        specular: [reader.readFloat32(), reader.readFloat32(), reader.readFloat32()],
        ambient: [reader.readFloat32(), reader.readFloat32(), reader.readFloat32()],
        faceVertexCount: (() => {
          reader.readUint8();
          reader.readUint8();
          return reader.readUint32();
        })(),
        textureFileName: decodeShiftJis(reader.readBytes(20)),
      });
    }

    const boneCount = reader.readUint16();
    const bones: PmdBone[] = [];
    for (let index = 0; index < boneCount; index += 1) {
      bones.push({
        name: decodeShiftJis(reader.readBytes(20)),
        parentIndex: reader.readUint16(),
        position: (() => {
          reader.readUint16();
          reader.readUint8();
          reader.readUint16();
          return [reader.readFloat32(), reader.readFloat32(), reader.readFloat32()];
        })(),
      });
    }

    const ikCount = reader.readUint16();
    const ikChains: PmdIk[] = [];
    for (let index = 0; index < ikCount; index += 1) {
      const boneIndex = reader.readUint16();
      const targetBoneIndex = reader.readUint16();
      const chainLength = reader.readUint8();
      reader.readUint16();
      reader.readFloat32();
      for (let chainIndex = 0; chainIndex < chainLength; chainIndex += 1) {
        reader.readUint16();
      }
      ikChains.push({ boneIndex, targetBoneIndex, chainLength });
    }

    const morphCount = reader.readUint16();
    const morphs: PmdMorph[] = [];
    for (let index = 0; index < morphCount; index += 1) {
      const name = decodeShiftJis(reader.readBytes(20));
      const morphVertexCount = reader.readUint32();
      reader.readUint8();
      for (let vertexIndex = 0; vertexIndex < morphVertexCount; vertexIndex += 1) {
        reader.readUint32();
        reader.readFloat32();
        reader.readFloat32();
        reader.readFloat32();
      }
      morphs.push({ name, vertexCount: morphVertexCount });
    }

    return {
      header: { version, modelName, comment },
      vertices,
      indices,
      materials,
      bones,
      ikChains,
      morphs,
    };
  }
}

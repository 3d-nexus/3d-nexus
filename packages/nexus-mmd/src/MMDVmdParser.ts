import { BinaryReader } from "./BinaryReader";

export interface VmdInterpolation {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface VmdBoneFrame {
  name: string;
  frame: number;
  position: number[];
  rotation: number[];
  interpolation: number[][][];
}

export interface VmdMorphFrame {
  name: string;
  frame: number;
  weight: number;
}

export interface VmdDocument {
  header: string;
  modelName: string;
  boneFrames: VmdBoneFrame[];
  morphFrames: VmdMorphFrame[];
  cameraFrames: Array<{ frame: number }>;
  lightFrames: Array<{ frame: number }>;
  shadowFrames: Array<{ frame: number }>;
  ikFrames: Array<{ frame: number }>;
}

function decodeNullTerminated(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  const slice = end >= 0 ? bytes.subarray(0, end) : bytes;
  return new TextDecoder("shift-jis").decode(slice);
}

export class MMDVmdParser {
  parse(buffer: ArrayBuffer): VmdDocument {
    const reader = new BinaryReader(buffer);
    const header = reader.readString(30, "ascii").replace(/\0+$/, "");
    if (header !== "Vocaloid Motion Data 0002" && header !== "Vocaloid Motion Data file") {
      throw new Error("Invalid VMD header");
    }

    const modelName = decodeNullTerminated(reader.readBytes(20));
    const boneFrameCount = reader.readUint32();
    const boneFrames: VmdBoneFrame[] = [];
    for (let index = 0; index < boneFrameCount; index += 1) {
      const name = decodeNullTerminated(reader.readBytes(15));
      const frame = reader.readUint32();
      const position = [reader.readFloat32(), reader.readFloat32(), reader.readFloat32()];
      const rotation = [reader.readFloat32(), reader.readFloat32(), reader.readFloat32(), reader.readFloat32()];
      const bytes = reader.readBytes(64);
      const interpolation = Array.from({ length: 4 }, (_, axis) =>
        Array.from({ length: 4 }, (_, point) =>
          Array.from({ length: 4 }, (_, coord) => bytes[axis * 16 + point * 4 + coord] ?? 0),
        ),
      );
      boneFrames.push({ name, frame, position, rotation, interpolation });
    }

    const morphFrameCount = reader.readUint32();
    const morphFrames = Array.from({ length: morphFrameCount }, () => ({
      name: decodeNullTerminated(reader.readBytes(15)),
      frame: reader.readUint32(),
      weight: reader.readFloat32(),
    }));

    const skipFrames = (count: number, words: number, trailingBytes = 0): Array<{ frame: number }> =>
      Array.from({ length: count }, () => {
        const frame = reader.readUint32();
        for (let index = 0; index < words; index += 1) {
          reader.readFloat32();
        }
        if (trailingBytes) {
          reader.readBytes(trailingBytes);
        }
        return { frame };
      });

    const cameraFrames = skipFrames(reader.readUint32(), 7, 25);
    const lightFrames = skipFrames(reader.readUint32(), 6);
    const shadowFrames = skipFrames(reader.readUint32(), 1, 1);
    const ikFrameCount = reader.readUint32();
    const ikFrames = Array.from({ length: ikFrameCount }, () => {
      const frame = reader.readUint32();
      reader.readUint8();
      const entryCount = reader.readUint32();
      for (let index = 0; index < entryCount; index += 1) {
        reader.readBytes(20);
        reader.readUint8();
      }
      return { frame };
    });

    return { header, modelName, boneFrames, morphFrames, cameraFrames, lightFrames, shadowFrames, ikFrames };
  }
}

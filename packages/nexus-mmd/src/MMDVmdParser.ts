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
  interpolation: {
    x: VmdInterpolation;
    y: VmdInterpolation;
    z: VmdInterpolation;
    r: VmdInterpolation;
  };
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
  cameraFrames: Array<{
    frame: number;
    distance: number;
    position: number[];
    rotation: number[];
    interpolation: Uint8Array;
    fov: number;
    perspective: number;
  }>;
  lightFrames: Array<{ frame: number }>;
  shadowFrames: Array<{ frame: number }>;
  ikFrames: Array<{ frame: number; show: number; entries: Array<{ name: string; enabled: number }> }>;
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
      const interpolation = {
        x: { ax: bytes[0] ?? 0, ay: bytes[4] ?? 0, bx: bytes[8] ?? 0, by: bytes[12] ?? 0 },
        y: { ax: bytes[16] ?? 0, ay: bytes[20] ?? 0, bx: bytes[24] ?? 0, by: bytes[28] ?? 0 },
        z: { ax: bytes[32] ?? 0, ay: bytes[36] ?? 0, bx: bytes[40] ?? 0, by: bytes[44] ?? 0 },
        r: { ax: bytes[48] ?? 0, ay: bytes[52] ?? 0, bx: bytes[56] ?? 0, by: bytes[60] ?? 0 },
      };
      boneFrames.push({ name, frame, position, rotation, interpolation });
    }

    const morphFrameCount = reader.readUint32();
    const morphFrames = Array.from({ length: morphFrameCount }, () => ({
      name: decodeNullTerminated(reader.readBytes(15)),
      frame: reader.readUint32(),
      weight: reader.readFloat32(),
    }));

    const cameraFrameCount = reader.readUint32();
    const cameraFrames = Array.from({ length: cameraFrameCount }, () => {
      const frame = reader.readUint32();
      const distance = reader.readFloat32();
      const position = [reader.readFloat32(), reader.readFloat32(), reader.readFloat32()];
      const rotation = [reader.readFloat32(), reader.readFloat32(), reader.readFloat32()];
      const interpolation = reader.readBytes(24);
      const fov = reader.readUint32();
      const perspective = reader.readUint8();
      return { frame, distance, position, rotation, interpolation, fov, perspective };
    });

    const lightFrameCount = reader.readUint32();
    const lightFrames = Array.from({ length: lightFrameCount }, () => {
      const frame = reader.readUint32();
      for (let index = 0; index < 6; index += 1) {
        reader.readFloat32();
      }
      return { frame };
    });

    const shadowFrameCount = reader.readUint32();
    const shadowFrames = Array.from({ length: shadowFrameCount }, () => {
      const frame = reader.readUint32();
      reader.readUint8();
      reader.readFloat32();
      return { frame };
    });
    const ikFrameCount = reader.readUint32();
    const ikFrames = Array.from({ length: ikFrameCount }, () => {
      const frame = reader.readUint32();
      const show = reader.readUint8();
      const entryCount = reader.readUint32();
      const entries = [];
      for (let index = 0; index < entryCount; index += 1) {
        entries.push({
          name: decodeNullTerminated(reader.readBytes(20)),
          enabled: reader.readUint8(),
        });
      }
      return { frame, show, entries };
    });

    return { header, modelName, boneFrames, morphFrames, cameraFrames, lightFrames, shadowFrames, ikFrames };
  }
}

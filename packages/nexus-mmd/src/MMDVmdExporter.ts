import type { AiAnimation, AiQuatKey, AiScene, AiVectorKey } from "nexus-core";
import { BinaryWriter } from "./BinaryWriter";
import type { VmdInterpolation } from "./MMDVmdParser";

type CameraFrame = {
  frame: number;
  distance: number;
  position: number[];
  rotation: number[];
  interpolation?: number[] | Uint8Array | Record<string, number>;
  fov: number;
  perspective: number;
};

type IkFrame = {
  frame: number;
  show: number;
  entries: Array<{ name: string; enabled: number }>;
};

type MorphFrame = {
  name: string;
  frame: number;
  originalFrame?: number;
  weight: number;
};

type LightFrame = {
  frame: number;
  originalFrame?: number;
  color?: number[];
  position?: number[];
};

function firstAnimation(scene: AiScene): AiAnimation | undefined {
  return scene.animations[0];
}

function writeFixedString(writer: BinaryWriter, text: string, length: number): void {
  writer.writeString(text, "shift-jis", length);
}

function readSceneArray<T>(scene: AiScene, key: string): T[] {
  const raw = scene.metadata[key]?.data;
  if (typeof raw !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function toInterpolation(value: unknown): VmdInterpolation {
  if (!value || typeof value !== "object") {
    return { ax: 20, ay: 20, bx: 107, by: 107 };
  }
  const interpolation = value as Partial<VmdInterpolation>;
  return {
    ax: Number(interpolation.ax ?? 20),
    ay: Number(interpolation.ay ?? 20),
    bx: Number(interpolation.bx ?? 107),
    by: Number(interpolation.by ?? 107),
  };
}

function serializeInterpolation(positionKey: AiVectorKey, rotationKey: AiQuatKey | undefined): Uint8Array {
  const linear = { ax: 20, ay: 20, bx: 107, by: 107 };
  const vmd = (positionKey.interpolation as { vmd?: unknown[] } | undefined)?.vmd;
  const rotationVmd = (rotationKey?.interpolation as { vmd?: unknown[] } | undefined)?.vmd;
  const axes = [
    toInterpolation(vmd?.[0] ?? linear),
    toInterpolation(vmd?.[1] ?? linear),
    toInterpolation(vmd?.[2] ?? linear),
    toInterpolation(rotationVmd?.[3] ?? vmd?.[3] ?? linear),
  ];
  const bytes = new Uint8Array(64);
  axes.forEach((axis, index) => {
    const base = index * 16;
    bytes[base] = axis.ax;
    bytes[base + 4] = axis.ay;
    bytes[base + 8] = axis.bx;
    bytes[base + 12] = axis.by;
  });
  return bytes;
}

function coerceByteArray(value: CameraFrame["interpolation"], size: number): Uint8Array {
  if (value instanceof Uint8Array) {
    return value.length === size ? value : Uint8Array.from(Array.from(value).slice(0, size).concat(Array(Math.max(0, size - value.length)).fill(0)));
  }
  if (Array.isArray(value)) {
    return Uint8Array.from(value.map((entry) => Number(entry ?? 0)).slice(0, size).concat(Array(Math.max(0, size - value.length)).fill(0)));
  }
  if (value && typeof value === "object") {
    return Uint8Array.from(
      Array.from({ length: size }, (_, index) => Number((value as Record<string, number>)[index] ?? 0)),
    );
  }
  return new Uint8Array(size);
}

export class MMDVmdExporter {
  write(scene: AiScene): ArrayBuffer {
    const writer = new BinaryWriter();
    const animation = firstAnimation(scene);
    writeFixedString(writer, "Vocaloid Motion Data 0002", 30);
    writeFixedString(writer, scene.rootNode.name || "Model", 20);

    const boneFrames =
      animation?.channels.flatMap((channel) =>
        channel.positionKeys.map((positionKey, index) => ({
          name: channel.nodeName,
          frame: positionKey.time,
          positionKey,
          rotationKey: channel.rotationKeys[index],
        })),
      ) ?? [];

    writer.writeUint32(boneFrames.length);
    boneFrames.forEach((frame, index) => {
      const rotationKey = frame.rotationKey;
      writeFixedString(writer, frame.name, 15);
      writer.writeUint32(frame.frame);
      writer.writeFloat32(frame.positionKey.value.x);
      writer.writeFloat32(frame.positionKey.value.y);
      writer.writeFloat32(frame.positionKey.value.z);
      writer.writeFloat32(rotationKey?.value.x ?? 0);
      writer.writeFloat32(rotationKey?.value.y ?? 0);
      writer.writeFloat32(rotationKey?.value.z ?? 0);
      writer.writeFloat32(rotationKey?.value.w ?? 1);
      writer.writeBytes(serializeInterpolation(frame.positionKey, rotationKey));
    });

    const morphFrames =
      readSceneArray<MorphFrame>(scene, "mmd:morphFrames").length > 0
        ? readSceneArray<MorphFrame>(scene, "mmd:morphFrames")
        : (animation?.morphMeshChannels.flatMap((channel) =>
            channel.keys.map((key) => ({ name: channel.name, frame: key.time, originalFrame: key.time, weight: key.weights[0] ?? 0 })),
          ) ?? []);
    writer.writeUint32(morphFrames.length);
    morphFrames.forEach((frame) => {
      writeFixedString(writer, frame.name, 15);
      writer.writeUint32(Math.round(Number(frame.frame ?? frame.originalFrame ?? 0)));
      writer.writeFloat32(frame.weight);
    });

    const cameraFrames = readSceneArray<CameraFrame>(scene, "mmd:cameraFrames");
    writer.writeUint32(cameraFrames.length);
    cameraFrames.forEach((frame) => {
      writer.writeUint32(Number(frame.frame ?? 0));
      writer.writeFloat32(Number(frame.distance ?? 0));
      (frame.position ?? [0, 0, 0]).slice(0, 3).forEach((value) => writer.writeFloat32(Number(value ?? 0)));
      (frame.rotation ?? [0, 0, 0]).slice(0, 3).forEach((value) => writer.writeFloat32(Number(value ?? 0)));
      writer.writeBytes(coerceByteArray(frame.interpolation, 24));
      writer.writeUint32(Number(frame.fov ?? 45));
      writer.writeUint8(Number(frame.perspective ?? 0));
    });

    const lightFrames = readSceneArray<LightFrame>(scene, "mmd:lightFrames");
    writer.writeUint32(lightFrames.length);
    lightFrames.forEach((frame) => {
      writer.writeUint32(Math.round(Number(frame.frame ?? frame.originalFrame ?? 0)));
      (frame.color ?? [1, 1, 1]).slice(0, 3).forEach((value) => writer.writeFloat32(Number(value ?? 0)));
      (frame.position ?? [0, 0, 0]).slice(0, 3).forEach((value) => writer.writeFloat32(Number(value ?? 0)));
    });
    writer.writeUint32(0);

    const ikFrames = readSceneArray<IkFrame>(scene, "mmd:ikFrames");
    writer.writeUint32(ikFrames.length);
    ikFrames.forEach((frame) => {
      writer.writeUint32(Number(frame.frame ?? 0));
      writer.writeUint8(Number(frame.show ?? 0));
      writer.writeUint32(frame.entries?.length ?? 0);
      frame.entries?.forEach((entry) => {
        writeFixedString(writer, entry.name, 20);
        writer.writeUint8(Number(entry.enabled ?? 0));
      });
    });

    return writer.toArrayBuffer();
  }
}

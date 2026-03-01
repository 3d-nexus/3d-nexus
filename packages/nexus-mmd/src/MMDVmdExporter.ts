import type { AiAnimation, AiScene } from "nexus-core";

class BinaryWriter {
  private readonly bytes: number[] = [];

  writeUint8(value: number): void {
    this.bytes.push(value & 0xff);
  }

  writeUint32(value: number): void {
    this.bytes.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
  }

  writeFloat32(value: number): void {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, value, true);
    this.bytes.push(...new Uint8Array(buffer));
  }

  writeFixedString(text: string, length: number): void {
    const encoded = new TextEncoder().encode(text);
    const bytes = new Uint8Array(length);
    bytes.set(encoded.subarray(0, length));
    this.bytes.push(...bytes);
  }

  writeZeros(length: number): void {
    this.bytes.push(...new Uint8Array(length));
  }

  toArrayBuffer(): ArrayBuffer {
    return Uint8Array.from(this.bytes).buffer;
  }
}

function firstAnimation(scene: AiScene): AiAnimation | undefined {
  return scene.animations[0];
}

export class MMDVmdExporter {
  write(scene: AiScene): ArrayBuffer {
    const writer = new BinaryWriter();
    const animation = firstAnimation(scene);
    writer.writeFixedString("Vocaloid Motion Data 0002", 30);
    writer.writeFixedString(scene.rootNode.name || "Model", 20);

    const boneFrames = animation?.channels.flatMap((channel) =>
      channel.positionKeys.map((positionKey, index) => ({
        name: channel.nodeName,
        frame: positionKey.time,
        position: positionKey.value,
        rotation: channel.rotationKeys[index]?.value ?? { x: 0, y: 0, z: 0, w: 1 },
      })),
    ) ?? [];

    writer.writeUint32(boneFrames.length);
    boneFrames.forEach((frame) => {
      writer.writeFixedString(frame.name, 15);
      writer.writeUint32(frame.frame);
      writer.writeFloat32(frame.position.x);
      writer.writeFloat32(frame.position.y);
      writer.writeFloat32(frame.position.z);
      writer.writeFloat32(frame.rotation.x);
      writer.writeFloat32(frame.rotation.y);
      writer.writeFloat32(frame.rotation.z);
      writer.writeFloat32(frame.rotation.w);
      writer.writeZeros(64);
    });

    const morphFrames = animation?.morphMeshChannels.flatMap((channel) =>
      channel.keys.map((key) => ({ name: channel.name, frame: key.time, weight: key.weights[0] ?? 0 })),
    ) ?? [];
    writer.writeUint32(morphFrames.length);
    morphFrames.forEach((frame) => {
      writer.writeFixedString(frame.name, 15);
      writer.writeUint32(frame.frame);
      writer.writeFloat32(frame.weight);
    });

    writer.writeUint32(0);
    writer.writeUint32(0);
    writer.writeUint32(0);
    writer.writeUint32(0);
    return writer.toArrayBuffer();
  }
}

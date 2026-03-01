import type { AiScene } from "nexus-core";

class BinaryWriter {
  private readonly bytes: number[] = [];

  writeUint8(value: number): void {
    this.bytes.push(value & 0xff);
  }

  writeUint16(value: number): void {
    this.bytes.push(value & 0xff, (value >> 8) & 0xff);
  }

  writeUint32(value: number): void {
    this.bytes.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
  }

  writeInt32(value: number): void {
    this.writeUint32(value >>> 0);
  }

  writeFloat32(value: number): void {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, value, true);
    this.bytes.push(...new Uint8Array(buffer));
  }

  writeString(text: string): void {
    const encoded = new TextEncoder().encode(text);
    this.writeInt32(encoded.length);
    this.bytes.push(...encoded);
  }

  writeBytes(bytes: number[] | Uint8Array): void {
    this.bytes.push(...bytes);
  }

  toArrayBuffer(): ArrayBuffer {
    return Uint8Array.from(this.bytes).buffer;
  }
}

export class MMDPmxExporter {
  write(scene: AiScene): ArrayBuffer {
    const writer = new BinaryWriter();
    const mesh = scene.meshes[0];
    if (!mesh) {
      throw new Error("Cannot export PMX without at least one mesh");
    }
    writer.writeBytes(new TextEncoder().encode("PMX "));
    writer.writeFloat32(2.0);
    writer.writeUint8(8);
    writer.writeBytes([1, 0, 4, 4, 4, 4, 4, 4]);
    writer.writeString(scene.rootNode.name);
    writer.writeString(scene.rootNode.name);
    writer.writeString("");
    writer.writeString("");
    writer.writeUint32(mesh.vertices.length);
    mesh.vertices.forEach((vertex, index) => {
      writer.writeFloat32(vertex.x);
      writer.writeFloat32(vertex.y);
      writer.writeFloat32(vertex.z);
      const normal = mesh.normals[index] ?? { x: 0, y: 1, z: 0 };
      writer.writeFloat32(normal.x);
      writer.writeFloat32(normal.y);
      writer.writeFloat32(normal.z);
      const uv = mesh.textureCoords[0]?.[index] ?? { x: 0, y: 0 };
      writer.writeFloat32(uv.x);
      writer.writeFloat32(uv.y);
      writer.writeUint8(0);
      writer.writeInt32(0);
      writer.writeFloat32(1);
    });

    const indices = mesh.faces.flatMap((face) => face.indices);
    writer.writeUint32(indices.length);
    indices.forEach((index) => writer.writeUint32(index));
    writer.writeUint32(0);
    writer.writeUint32(1);
    writer.writeString(scene.materials[0]?.name ?? "Material");
    writer.writeString(scene.materials[0]?.name ?? "Material");
    writer.writeFloat32(1);
    writer.writeFloat32(1);
    writer.writeFloat32(1);
    writer.writeFloat32(1);
    writer.writeFloat32(0.5);
    writer.writeFloat32(0.5);
    writer.writeFloat32(0.5);
    writer.writeFloat32(16);
    writer.writeFloat32(0.2);
    writer.writeFloat32(0.2);
    writer.writeFloat32(0.2);
    writer.writeUint8(0);
    writer.writeFloat32(0);
    writer.writeFloat32(0);
    writer.writeFloat32(0);
    writer.writeFloat32(1);
    writer.writeFloat32(1);
    writer.writeUint8(0);
    writer.writeInt32(-1);
    writer.writeInt32(-1);
    writer.writeUint8(0);
    writer.writeUint8(0);
    writer.writeInt32(0);
    writer.writeInt32(indices.length);
    writer.writeUint32(Math.max(1, scene.rootNode.children.length));
    const bones = scene.rootNode.children.length
      ? scene.rootNode.children
      : [{ name: "RootBone", parent: null } as const];
    bones.forEach((bone, index) => {
      writer.writeString(bone.name);
      writer.writeString(bone.name);
      writer.writeFloat32(0);
      writer.writeFloat32(0);
      writer.writeFloat32(0);
      writer.writeInt32(bone.parent ? Math.max(0, index - 1) : -1);
      writer.writeInt32(0);
      writer.writeUint16(0);
      writer.writeFloat32(0);
      writer.writeFloat32(1);
      writer.writeFloat32(0);
    });
    writer.writeUint32(0);
    writer.writeUint32(0);
    writer.writeUint32(0);
    writer.writeUint32(0);
    writer.writeUint32(0);
    return writer.toArrayBuffer();
  }
}

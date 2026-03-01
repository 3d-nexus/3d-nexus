import type { AiMesh, AiScene, AiVector3D, SdefCoeffs } from "nexus-core";
import { BinaryWriter } from "./BinaryWriter";

type VertexBoneEntry = { boneIdx: number; weight: number; ikChain?: SdefCoeffs };

function writeVec3(writer: BinaryWriter, value: AiVector3D): void {
  writer.writeFloat32(value.x);
  writer.writeFloat32(value.y);
  writer.writeFloat32(value.z);
}

function buildVertexWeightLookup(mesh: AiMesh): Map<number, VertexBoneEntry[]> {
  const lookup = new Map<number, VertexBoneEntry[]>();

  mesh.bones.forEach((bone, boneIdx) => {
    bone.weights.forEach((weight) => {
      const entries = lookup.get(weight.vertexId) ?? [];
      const ikChain = bone.ikChain as SdefCoeffs | undefined;
      entries.push({
        boneIdx,
        weight: weight.weight,
        ...(ikChain ? { ikChain } : {}),
      });
      lookup.set(weight.vertexId, entries);
    });
  });

  lookup.forEach((entries, vertexId) => {
    lookup.set(
      vertexId,
      entries
        .filter((entry) => entry.weight > 0)
        .sort((left, right) => right.weight - left.weight)
        .slice(0, 4),
    );
  });

  return lookup;
}

function writeVertexSkinning(writer: BinaryWriter, entries: VertexBoneEntry[]): void {
  if (entries.length <= 1) {
    writer.writeUint8(0);
    writer.writeInt32(entries[0]?.boneIdx ?? 0);
    return;
  }

  const sdefEntry = entries.find((entry) => entry.ikChain?.type === "sdef");
  if (entries.length === 2 && sdefEntry?.ikChain) {
    writer.writeUint8(3);
    writer.writeInt32(entries[0]!.boneIdx);
    writer.writeInt32(entries[1]!.boneIdx);
    writer.writeFloat32(entries[0]!.weight);
    writeVec3(writer, sdefEntry.ikChain.c);
    writeVec3(writer, sdefEntry.ikChain.r0);
    writeVec3(writer, sdefEntry.ikChain.r1);
    return;
  }

  if (entries.length === 2) {
    writer.writeUint8(1);
    writer.writeInt32(entries[0]!.boneIdx);
    writer.writeInt32(entries[1]!.boneIdx);
    writer.writeFloat32(entries[0]!.weight);
    return;
  }

  writer.writeUint8(2);
  const padded = [...entries];
  while (padded.length < 4) {
    padded.push({ boneIdx: 0, weight: 0 });
  }
  padded.forEach((entry) => writer.writeInt32(entry.boneIdx));
  padded.forEach((entry) => writer.writeFloat32(entry.weight));
}

export class MMDPmxExporter {
  write(scene: AiScene): ArrayBuffer {
    const writer = new BinaryWriter();
    const mesh = scene.meshes[0];
    if (!mesh) {
      throw new Error("Cannot export PMX without at least one mesh");
    }

    const vertexWeightLookup = buildVertexWeightLookup(mesh);

    writer.writeBytes(new TextEncoder().encode("PMX "));
    writer.writeFloat32(2.0);
    writer.writeUint8(8);
    writer.writeBytes(Uint8Array.from([1, 0, 4, 4, 4, 4, 4, 4]));
    writer.writeString(scene.rootNode.name, "utf-8");
    writer.writeString(scene.rootNode.name, "utf-8");
    writer.writeString("", "utf-8");
    writer.writeString("", "utf-8");
    writer.writeUint32(mesh.vertices.length);

    mesh.vertices.forEach((vertex, index) => {
      writeVec3(writer, vertex);
      writeVec3(writer, mesh.normals[index] ?? { x: 0, y: 1, z: 0 });
      writer.writeFloat32(mesh.textureCoords[0]?.[index]?.x ?? 0);
      writer.writeFloat32(mesh.textureCoords[0]?.[index]?.y ?? 0);
      writeVertexSkinning(writer, vertexWeightLookup.get(index) ?? []);
      writer.writeFloat32(1);
    });

    const indices = mesh.faces.flatMap((face) => face.indices);
    writer.writeUint32(indices.length);
    indices.forEach((index) => writer.writeUint32(index));
    writer.writeUint32(0);
    writer.writeUint32(1);
    writer.writeString(scene.materials[0]?.name ?? "Material", "utf-8");
    writer.writeString(scene.materials[0]?.name ?? "Material", "utf-8");
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
      writer.writeString(bone.name, "utf-8");
      writer.writeString(bone.name, "utf-8");
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

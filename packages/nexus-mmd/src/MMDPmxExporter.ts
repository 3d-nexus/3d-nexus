import type { AiMaterial, AiMaterialProperty, AiMesh, AiScene, AiVector3D, SdefCoeffs } from "nexus-core";
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

function parseMetadataArray(scene: AiScene, key: string): Array<Record<string, unknown>> {
  try {
    const raw = scene.metadata[key]?.data;
    if (typeof raw !== "string") {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getMaterialProperty(material: AiMaterial | undefined, key: string): AiMaterialProperty | undefined {
  return material?.properties.find((property) => property.key === key);
}

function getStringProperty(material: AiMaterial | undefined, key: string): string | undefined {
  const value = getMaterialProperty(material, key)?.data;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumberProperty(material: AiMaterial | undefined, key: string, fallback: number): number {
  const value = getMaterialProperty(material, key)?.data;
  return typeof value === "number" ? value : fallback;
}

function getColor4(material: AiMaterial | undefined, key: string, fallback: [number, number, number, number]): [number, number, number, number] {
  const value = getMaterialProperty(material, key)?.data as Partial<{ r: number; g: number; b: number; a: number }> | undefined;
  if (!value || typeof value !== "object") {
    return fallback;
  }
  return [Number(value.r ?? fallback[0]), Number(value.g ?? fallback[1]), Number(value.b ?? fallback[2]), Number(value.a ?? fallback[3])];
}

function getColor3(material: AiMaterial | undefined, key: string, fallback: [number, number, number]): [number, number, number] {
  const value = getMaterialProperty(material, key)?.data as Partial<{ r: number; g: number; b: number }> | undefined;
  if (!value || typeof value !== "object") {
    return fallback;
  }
  return [Number(value.r ?? fallback[0]), Number(value.g ?? fallback[1]), Number(value.b ?? fallback[2])];
}

function collectTexturePaths(scene: AiScene): string[] {
  const seen = new Set<string>();
  const textures: string[] = [];
  scene.meshes.forEach((mesh) => {
    const path = getStringProperty(scene.materials[mesh.materialIndex], "$tex.file");
    if (path && !seen.has(path)) {
      seen.add(path);
      textures.push(path);
    }
  });
  return textures;
}

function writeMaterialBlock(
  writer: BinaryWriter,
  material: AiMaterial | undefined,
  faceVertexCount: number,
  textureIndexLookup: Map<string, number>,
): void {
  const name = material?.name ?? "Material";
  const diffuse = getColor4(material, "$clr.diffuse", [1, 1, 1, 1]);
  const specular = getColor3(material, "$clr.specular", [0.5, 0.5, 0.5]);
  const ambient = getColor3(material, "$clr.ambient", [0.2, 0.2, 0.2]);
  const edgeColor = getColor4(material, "mmd:edgeColor", [0, 0, 0, 1]);
  const edgeSize = getNumberProperty(material, "mmd:edgeSize", 1);
  const sphereMode = getNumberProperty(material, "mmd:sphereMode", 0);
  const toonIndex = getNumberProperty(material, "mmd:toonIndex", 0);
  const texturePath = getStringProperty(material, "$tex.file");
  const textureIndex = texturePath ? (textureIndexLookup.get(texturePath) ?? -1) : -1;

  writer.writeString(name, "utf-8");
  writer.writeString(name, "utf-8");
  diffuse.forEach((value) => writer.writeFloat32(value));
  specular.forEach((value) => writer.writeFloat32(value));
  writer.writeFloat32(16);
  ambient.forEach((value) => writer.writeFloat32(value));
  writer.writeUint8(0);
  edgeColor.forEach((value) => writer.writeFloat32(value));
  writer.writeFloat32(edgeSize);
  writer.writeUint8(0);
  writer.writeInt32(textureIndex);
  writer.writeInt32(-1);
  writer.writeUint8(sphereMode);
  writer.writeUint8(Math.max(0, Math.min(255, toonIndex)));
  writer.writeInt32(0);
  writer.writeInt32(faceVertexCount);
}

function writeMorphs(writer: BinaryWriter, scene: AiScene, mesh: AiMesh, baseVertices: AiVector3D[]): void {
  const vertexMorphs = mesh.morphTargets.filter((target) => !target.name.startsWith("UV:"));
  const uvMorphs = mesh.morphTargets.filter((target) => target.name.startsWith("UV:"));
  const boneMorphs = parseMetadataArray(scene, "mmd:boneMorphs");
  const materialMorphs = parseMetadataArray(scene, "mmd:materialMorphs");
  const groupMorphs = parseMetadataArray(scene, "mmd:groupMorphs");
  const totalCount = vertexMorphs.length + uvMorphs.length + boneMorphs.length + materialMorphs.length + groupMorphs.length;
  writer.writeUint32(totalCount);

  vertexMorphs.forEach((morph) => {
    const offsets = morph.vertices
      .map((vertex, index) => ({
        vertexIndex: index,
        delta: {
          x: vertex.x - (baseVertices[index]?.x ?? 0),
          y: vertex.y - (baseVertices[index]?.y ?? 0),
          z: vertex.z - (baseVertices[index]?.z ?? 0),
        },
      }))
      .filter((entry) => Math.abs(entry.delta.x) + Math.abs(entry.delta.y) + Math.abs(entry.delta.z) > 1e-6);
    writer.writeString(morph.name, "utf-8");
    writer.writeString(morph.name, "utf-8");
    writer.writeUint8(0);
    writer.writeUint8(1);
    writer.writeInt32(offsets.length);
    offsets.forEach((entry) => {
      writer.writeUint32(entry.vertexIndex);
      writeVec3(writer, entry.delta);
    });
  });

  uvMorphs.forEach((morph) => {
    const offsets = morph.textureCoords[0]
      ?.map((uv, index) => ({
          vertexIndex: index,
          uv,
        }))
      .filter((entry) => entry.uv && (Math.abs(entry.uv.x) + Math.abs(entry.uv.y) + Math.abs(entry.uv.z)) > 1e-6) ?? [];
    writer.writeString(morph.name.replace(/^UV:/, ""), "utf-8");
    writer.writeString(morph.name.replace(/^UV:/, ""), "utf-8");
    writer.writeUint8(0);
    writer.writeUint8(3);
    writer.writeInt32(offsets.length);
    offsets.forEach((entry) => {
      writer.writeUint32(entry.vertexIndex);
      writer.writeFloat32(entry.uv!.x);
      writer.writeFloat32(entry.uv!.y);
      writer.writeFloat32(entry.uv!.z);
      writer.writeFloat32(0);
    });
  });

  boneMorphs.forEach((morph) => {
    const entries = Array.isArray(morph.entries) ? morph.entries : [];
    writer.writeString(String(morph.name ?? "BoneMorph"), "utf-8");
    writer.writeString(String(morph.name ?? "BoneMorph"), "utf-8");
    writer.writeUint8(0);
    writer.writeUint8(2);
    writer.writeInt32(entries.length);
    entries.forEach((entry) => {
      writer.writeInt32(Number((entry as { boneIndex?: number }).boneIndex ?? -1));
      const translation = (entry as { translation?: number[] }).translation ?? [0, 0, 0];
      const rotation = (entry as { rotation?: number[] }).rotation ?? [0, 0, 0, 1];
      writeVec3(writer, { x: translation[0] ?? 0, y: translation[1] ?? 0, z: translation[2] ?? 0 });
      writer.writeFloat32(rotation[0] ?? 0);
      writer.writeFloat32(rotation[1] ?? 0);
      writer.writeFloat32(rotation[2] ?? 0);
      writer.writeFloat32(rotation[3] ?? 1);
    });
  });

  materialMorphs.forEach((morph) => {
    const entries = Array.isArray(morph.entries) ? morph.entries : [];
    writer.writeString(String(morph.name ?? "MaterialMorph"), "utf-8");
    writer.writeString(String(morph.name ?? "MaterialMorph"), "utf-8");
    writer.writeUint8(0);
    writer.writeUint8(8);
    writer.writeInt32(entries.length);
    entries.forEach((entry) => {
      writer.writeInt32(Number((entry as { materialIndex?: number }).materialIndex ?? -1));
      writer.writeUint8(Number((entry as { operation?: number }).operation ?? 0));
      const diffuse = (entry as { diffuse?: number[] }).diffuse ?? [0, 0, 0, 0];
      diffuse.forEach((value) => writer.writeFloat32(value ?? 0));
      const specular = (entry as { specular?: number[] }).specular ?? [0, 0, 0];
      specular.forEach((value) => writer.writeFloat32(value ?? 0));
      writer.writeFloat32(Number((entry as { shininess?: number }).shininess ?? 0));
      const ambient = (entry as { ambient?: number[] }).ambient ?? [0, 0, 0];
      ambient.forEach((value) => writer.writeFloat32(value ?? 0));
      const edge = (entry as { edge?: number[] }).edge ?? [0, 0, 0, 0];
      edge.forEach((value) => writer.writeFloat32(value ?? 0));
      writer.writeFloat32(Number((entry as { edgeSize?: number }).edgeSize ?? 0));
      const texture = (entry as { texture?: number[] }).texture ?? [0, 0, 0, 0];
      texture.forEach((value) => writer.writeFloat32(value ?? 0));
      const sphereTexture = (entry as { sphereTexture?: number[] }).sphereTexture ?? [0, 0, 0, 0];
      sphereTexture.forEach((value) => writer.writeFloat32(value ?? 0));
      const toon = (entry as { toon?: number[] }).toon ?? [0, 0, 0, 0];
      toon.forEach((value) => writer.writeFloat32(value ?? 0));
    });
  });

  groupMorphs.forEach((morph) => {
    const entries = Array.isArray(morph.entries) ? morph.entries : [];
    writer.writeString(String(morph.name ?? "GroupMorph"), "utf-8");
    writer.writeString(String(morph.name ?? "GroupMorph"), "utf-8");
    writer.writeUint8(0);
    writer.writeUint8(0);
    writer.writeInt32(entries.length);
    entries.forEach((entry) => {
      writer.writeInt32(Number((entry as { morphIndex?: number }).morphIndex ?? -1));
      writer.writeFloat32(Number((entry as { weight?: number }).weight ?? 0));
    });
  });
}

function writeRigidBodies(writer: BinaryWriter, scene: AiScene): void {
  const rigidBodies = parseMetadataArray(scene, "mmd:rigidBodies");
  if (rigidBodies.length === 0) {
    writer.writeUint32(0);
    return;
  }
  writer.writeUint32(rigidBodies.length);
  rigidBodies.forEach((entry) => {
    writer.writeString(String(entry.name ?? ""), "utf-8");
    writer.writeString(String(entry.englishName ?? entry.name ?? ""), "utf-8");
    writer.writeInt32(Number(entry.boneIndex ?? -1));
    writer.writeUint8(Number(entry.groupIndex ?? 0));
    writer.writeUint16(Number(entry.nonCollisionMask ?? 0));
    writer.writeUint8(Number(entry.shape ?? 0));
    ((entry.size as number[] | undefined) ?? [1, 1, 1]).forEach((value) => writer.writeFloat32(value ?? 0));
    ((entry.position as number[] | undefined) ?? [0, 0, 0]).forEach((value) => writer.writeFloat32(value ?? 0));
    ((entry.rotation as number[] | undefined) ?? [0, 0, 0]).forEach((value) => writer.writeFloat32(value ?? 0));
    writer.writeFloat32(Number(entry.mass ?? 0));
    writer.writeFloat32(Number(entry.translateDamping ?? 0));
    writer.writeFloat32(Number(entry.rotateDamping ?? 0));
    writer.writeFloat32(Number(entry.repulsion ?? 0));
    writer.writeFloat32(Number(entry.friction ?? 0));
    writer.writeUint8(Number(entry.physicsMode ?? 0));
  });
}

function writeJoints(writer: BinaryWriter, scene: AiScene): void {
  const joints = parseMetadataArray(scene, "mmd:joints");
  if (joints.length === 0) {
    writer.writeUint32(0);
    return;
  }
  writer.writeUint32(joints.length);
  joints.forEach((entry) => {
    writer.writeString(String(entry.name ?? ""), "utf-8");
    writer.writeString(String(entry.englishName ?? entry.name ?? ""), "utf-8");
    writer.writeUint8(Number(entry.type ?? 0));
    writer.writeInt32(Number(entry.rigidBodyA ?? -1));
    writer.writeInt32(Number(entry.rigidBodyB ?? -1));
    [
      entry.position,
      entry.rotation,
      entry.limitPositionMin,
      entry.limitPositionMax,
      entry.limitRotationMin,
      entry.limitRotationMax,
      entry.springPosition,
      entry.springRotation,
    ].forEach((vector) => {
      ((vector as number[] | undefined) ?? [0, 0, 0]).forEach((value) => writer.writeFloat32(value ?? 0));
    });
  });
}

export class MMDPmxExporter {
  write(scene: AiScene): ArrayBuffer {
    const writer = new BinaryWriter();
    if (scene.meshes.length === 0) {
      throw new Error("Cannot export PMX without at least one mesh");
    }
    const meshes = scene.meshes;
    const vertexWeightLookups = meshes.map((mesh) => buildVertexWeightLookup(mesh));
    const vertexOffsets: number[] = [];
    let runningVertexOffset = 0;
    meshes.forEach((mesh) => {
      vertexOffsets.push(runningVertexOffset);
      runningVertexOffset += mesh.vertices.length;
    });
    const textures = collectTexturePaths(scene);
    const textureIndexLookup = new Map(textures.map((path, index) => [path, index]));

    writer.writeBytes(new TextEncoder().encode("PMX "));
    writer.writeFloat32(2.0);
    writer.writeUint8(8);
    writer.writeBytes(Uint8Array.from([1, 0, 4, 4, 4, 4, 4, 4]));
    writer.writeString(scene.rootNode.name, "utf-8");
    writer.writeString(scene.rootNode.name, "utf-8");
    writer.writeString("", "utf-8");
    writer.writeString("", "utf-8");
    writer.writeUint32(runningVertexOffset);

    meshes.forEach((mesh, meshIndex) => {
      const vertexWeightLookup = vertexWeightLookups[meshIndex]!;
      mesh.vertices.forEach((vertex, index) => {
        writeVec3(writer, vertex);
        writeVec3(writer, mesh.normals[index] ?? { x: 0, y: 1, z: 0 });
        writer.writeFloat32(mesh.textureCoords[0]?.[index]?.x ?? 0);
        writer.writeFloat32(mesh.textureCoords[0]?.[index]?.y ?? 0);
        writeVertexSkinning(writer, vertexWeightLookup.get(index) ?? []);
        writer.writeFloat32(1);
      });
    });

    const indices = meshes.flatMap((mesh, meshIndex) =>
      mesh.faces.flatMap((face) => face.indices.map((index) => index + vertexOffsets[meshIndex]!)),
    );
    writer.writeUint32(indices.length);
    indices.forEach((index) => writer.writeUint32(index));
    writer.writeUint32(textures.length);
    textures.forEach((texture) => writer.writeString(texture, "utf-8"));
    writer.writeUint32(meshes.length);
    meshes.forEach((mesh) => {
      writeMaterialBlock(
        writer,
        scene.materials[mesh.materialIndex],
        mesh.faces.reduce((total, face) => total + face.indices.length, 0),
        textureIndexLookup,
      );
    });
    const allBones = meshes.flatMap((mesh) => mesh.bones);
    writer.writeUint32(Math.max(1, allBones.length));
    const bones = allBones.length
      ? allBones.map((bone) => ({
          name: bone.name,
          parent: scene.rootNode.children.find((child) => child.name === bone.name)?.parent ?? null,
        }))
      : [{ name: "RootBone", parent: null } as const];
    const boneIndexLookup = new Map(bones.map((bone, index) => [bone.name, index]));
    bones.forEach((bone, index) => {
      writer.writeString(bone.name, "utf-8");
      writer.writeString(bone.name, "utf-8");
      writer.writeFloat32(0);
      writer.writeFloat32(0);
      writer.writeFloat32(0);
      const parentName = (bone.parent as { name?: string } | null)?.name;
      writer.writeInt32(parentName ? (boneIndexLookup.get(parentName) ?? -1) : -1);
      writer.writeInt32(0);
      writer.writeUint16(0);
      writer.writeFloat32(0);
      writer.writeFloat32(1);
      writer.writeFloat32(0);
    });
    writeMorphs(writer, scene, meshes[0]!, meshes[0]!.vertices);
    writer.writeUint32(0);
    writeRigidBodies(writer, scene);
    writeJoints(writer, scene);
    writer.writeUint32(0);
    return writer.toArrayBuffer();
  }
}

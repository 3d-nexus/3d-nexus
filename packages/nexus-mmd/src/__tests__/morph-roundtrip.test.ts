import { describe, expect, it } from "vitest";
import { createIdentityMatrix4x4, type AiScene } from "nexus-core";
import { MMDImporter } from "../MMDImporter";
import { MMDPmxExporter } from "../MMDPmxExporter";

function metadataCount(scene: AiScene, key: string): number {
  const raw = scene.metadata[key]?.data;
  if (typeof raw !== "string") {
    return 0;
  }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.length : 0;
}

function totalMorphCount(scene: AiScene): number {
  return (
    (scene.meshes[0]?.morphTargets.length ?? 0) +
    metadataCount(scene, "mmd:boneMorphs") +
    metadataCount(scene, "mmd:materialMorphs") +
    metadataCount(scene, "mmd:groupMorphs")
  );
}

function createMorphScene(): AiScene {
  const vertices = Array.from({ length: 50 }, (_, index) => ({
    x: index * 0.1,
    y: 0,
    z: 0,
  }));
  const baseUv = vertices.map(() => ({ x: 0, y: 0, z: 0 }));
  const vertexMorphVertices = vertices.map((vertex, index) =>
    index === 42 ? { x: vertex.x, y: vertex.y + 1.5, z: vertex.z } : { ...vertex },
  );
  const uvMorphOffsets = vertices.map((_, index) => (index === 42 ? { x: 0.25, y: -0.5, z: 0 } : { x: 0, y: 0, z: 0 }));

  return {
    flags: 0 as never,
    rootNode: {
      name: "MorphRoot",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [],
      meshIndices: [0],
      metadata: null,
    },
    meshes: [
      {
        name: "MorphMesh",
        primitiveTypes: 4 as never,
        vertices,
        normals: vertices.map(() => ({ x: 0, y: 1, z: 0 })),
        tangents: [],
        bitangents: [],
        textureCoords: [baseUv, null, null, null, null, null, null, null],
        colors: Array.from({ length: 8 }, () => null),
        faces: [{ indices: [0, 1, 2] }],
        bones: [],
        materialIndex: 0,
        morphTargets: [
          {
            name: "Smile",
            vertices: vertexMorphVertices,
            normals: vertices.map(() => ({ x: 0, y: 1, z: 0 })),
            tangents: [],
            bitangents: [],
            colors: Array.from({ length: 8 }, () => null),
            textureCoords: [baseUv.map((value) => ({ ...value })), null, null, null, null, null, null, null],
            weight: 0,
          },
          {
            name: "UV:BlinkUV",
            vertices: vertices.map((vertex) => ({ ...vertex })),
            normals: vertices.map(() => ({ x: 0, y: 1, z: 0 })),
            tangents: [],
            bitangents: [],
            colors: Array.from({ length: 8 }, () => null),
            textureCoords: [uvMorphOffsets, null, null, null, null, null, null, null],
            weight: 0,
          },
        ],
        aabb: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: vertices[49]!.x, y: 1.5, z: 0 },
        },
      },
    ],
    materials: [{ name: "Material", properties: [] }],
    animations: [],
    textures: [],
    lights: [],
    cameras: [],
    metadata: {
      "mmd:boneMorphs": {
        type: 5 as never,
        data: JSON.stringify([{ name: "BoneMorph", entries: [{ boneIndex: 0, translation: [1, 2, 3], rotation: [0, 0, 0, 1] }] }]),
      },
      "mmd:materialMorphs": {
        type: 5 as never,
        data: JSON.stringify([
          {
            name: "MatMorph",
            entries: [
              {
                materialIndex: 0,
                operation: 1,
                diffuse: [1, 1, 1, 1],
                specular: [0.1, 0.1, 0.1],
                shininess: 16,
                ambient: [0.2, 0.2, 0.2],
                edge: [0, 0, 0, 1],
                edgeSize: 1,
                texture: [0, 0, 0, 0],
                sphereTexture: [0, 0, 0, 0],
                toon: [0, 0, 0, 0],
              },
            ],
          },
        ]),
      },
      "mmd:groupMorphs": {
        type: 5 as never,
        data: JSON.stringify([{ name: "GroupMorph", entries: [{ morphIndex: 0, weight: 0.5 }] }]),
      },
    },
  };
}

describe("PMX morph pipeline", () => {
  it("imports vertex and UV morph targets", () => {
    const importer = new MMDImporter();
    const buffer = new MMDPmxExporter().write(createMorphScene());

    const result = importer.read(buffer, "morph-fixture.pmx");
    const mesh = result.scene.meshes[0]!;

    expect(mesh.morphTargets).toHaveLength(2);
    expect(mesh.morphTargets[0]!.vertices[42]).toMatchObject({ y: 1.5 });
    expect(mesh.morphTargets[1]!.name.startsWith("UV:")).toBe(true);
    expect(metadataCount(result.scene, "mmd:boneMorphs")).toBe(1);
    expect(metadataCount(result.scene, "mmd:materialMorphs")).toBe(1);
    expect(metadataCount(result.scene, "mmd:groupMorphs")).toBe(1);
  });

  it("roundtrips total morph count", () => {
    const importer = new MMDImporter();
    const exporter = new MMDPmxExporter();

    const source = exporter.write(createMorphScene());
    const imported = importer.read(source, "source.pmx");
    const reexported = exporter.write(imported.scene);
    const reparsed = importer.read(reexported, "roundtrip.pmx");

    expect(totalMorphCount(reparsed.scene)).toBe(totalMorphCount(imported.scene));
    expect(totalMorphCount(reparsed.scene)).toBe(5);
  });
});

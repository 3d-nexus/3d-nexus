import { type AiAnimation, type AiQuaternion, type AiScene, type BaseExporter, type ExportSettings } from "nexus-core";
import { FbxExportNode } from "./FBXExportNode";
import { FBX_TICKS_PER_SECOND } from "./FBXTokenizer";

const ROOT_MODEL_ID = 100000;
const BASE_NODE_ID = 100001;

function flattenVertices(mesh: AiScene["meshes"][number]): string {
  return mesh.vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]).join(",");
}

function flattenPolygonIndices(mesh: AiScene["meshes"][number]): string {
  return mesh.faces
    .flatMap((face) => face.indices.map((index, idx) => (idx === face.indices.length - 1 ? -(index + 1) : index)))
    .join(",");
}

function flattenNormals(mesh: AiScene["meshes"][number]): string {
  return mesh.normals.flatMap((normal) => [normal.x, normal.y, normal.z]).join(",");
}

function flattenUvs(mesh: AiScene["meshes"][number]): string {
  return mesh.textureCoords[0]?.flatMap((uv) => [uv.x, uv.y]).join(",") ?? "";
}

function renderMaterialNode(id: number, name: string): FbxExportNode {
  return new FbxExportNode(
    "Material",
    [id, `Material::${name}`, "Material"],
    [],
    [
      new FbxExportNode("Properties70", [], [
        'P: "DiffuseColor", "Color", "", "A", 0.8, 0.6, 0.4',
      ]),
    ],
  );
}

function flattenBoneIndexes(mesh: AiScene["meshes"][number], boneIndex: number): string {
  return mesh.bones[boneIndex]?.weights.map((weight) => weight.vertexId).join(",") ?? "";
}

function flattenBoneWeights(mesh: AiScene["meshes"][number], boneIndex: number): string {
  return mesh.bones[boneIndex]?.weights.map((weight) => weight.weight).join(",") ?? "";
}

function flattenMatrix(mesh: AiScene["meshes"][number], boneIndex: number): string {
  return Array.from(mesh.bones[boneIndex]?.offsetMatrix.data ?? new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])).join(",");
}

function flattenShapeIndexes(mesh: AiScene["meshes"][number], morphIndex: number): string {
  return mesh.morphTargets[morphIndex]?.vertices
    .flatMap((vertex, vertexIndex) => {
      const base = mesh.vertices[vertexIndex];
      return base &&
        (Math.abs(vertex.x - base.x) > 1e-6 || Math.abs(vertex.y - base.y) > 1e-6 || Math.abs(vertex.z - base.z) > 1e-6)
        ? [vertexIndex]
        : [];
    })
    .join(",") ?? "";
}

function flattenShapeVertices(mesh: AiScene["meshes"][number], morphIndex: number): string {
  return mesh.morphTargets[morphIndex]?.vertices
    .flatMap((vertex, vertexIndex) => {
      const base = mesh.vertices[vertexIndex];
      return base &&
        (Math.abs(vertex.x - base.x) > 1e-6 || Math.abs(vertex.y - base.y) > 1e-6 || Math.abs(vertex.z - base.z) > 1e-6)
        ? [vertex.x - base.x, vertex.y - base.y, vertex.z - base.z]
        : [];
    })
    .join(",") ?? "";
}

function quaternionToEulerDegrees(quaternion: AiQuaternion): [number, number, number] {
  const sinrCosp = 2 * (quaternion.w * quaternion.x + quaternion.y * quaternion.z);
  const cosrCosp = 1 - 2 * (quaternion.x * quaternion.x + quaternion.y * quaternion.y);
  const x = Math.atan2(sinrCosp, cosrCosp);
  const sinp = 2 * (quaternion.w * quaternion.y - quaternion.z * quaternion.x);
  const y = Math.abs(sinp) >= 1 ? Math.sign(sinp) * (Math.PI / 2) : Math.asin(sinp);
  const sinyCosp = 2 * (quaternion.w * quaternion.z + quaternion.x * quaternion.y);
  const cosyCosp = 1 - 2 * (quaternion.y * quaternion.y + quaternion.z * quaternion.z);
  const z = Math.atan2(sinyCosp, cosyCosp);
  return [(x * 180) / Math.PI, (y * 180) / Math.PI, (z * 180) / Math.PI];
}

function toTick(time: number): number {
  return Math.trunc(time * Number(FBX_TICKS_PER_SECOND));
}

function writeAnimations(
  animations: AiAnimation[],
  nodeIdMap: Map<string, number>,
  objects: FbxExportNode[],
  connectionLines: string[],
  nextId: number,
): number {
  animations.forEach((animation, animationIndex) => {
    const stackId = nextId++;
    const layerId = nextId++;
    objects.push(
      new FbxExportNode("AnimationStack", [stackId, `AnimStack::${animation.name || `Take_${animationIndex}`}`, "AnimationStack"], [
        `LocalStart: 0`,
        `LocalStop: ${toTick(animation.duration)}`,
      ]),
    );
    objects.push(new FbxExportNode("AnimationLayer", [layerId, `AnimLayer::${animation.name || `Layer_${animationIndex}`}`, "AnimationLayer"]));
    connectionLines.push(`C: "OO", ${layerId}, ${stackId}`);

    animation.channels.forEach((channel) => {
      const modelId = nodeIdMap.get(channel.nodeName);
      if (!modelId) {
        return;
      }
      const curveSpecs = [
        {
          type: "T",
          keys: channel.positionKeys.map((key) => ({ time: key.time, values: [key.value.x, key.value.y, key.value.z] })),
        },
        {
          type: "R",
          keys: channel.rotationKeys.map((key) => ({ time: key.time, values: quaternionToEulerDegrees(key.value) })),
        },
        {
          type: "S",
          keys: channel.scalingKeys.map((key) => ({ time: key.time, values: [key.value.x, key.value.y, key.value.z] })),
        },
      ].filter((entry) => entry.keys.length > 0);

      curveSpecs.forEach((spec) => {
        const curveNodeId = nextId++;
        objects.push(new FbxExportNode("AnimationCurveNode", [curveNodeId, `AnimCurveNode::${spec.type}_${channel.nodeName}`, "AnimationCurveNode"]));
        connectionLines.push(`C: "OO", ${curveNodeId}, ${layerId}`);
        connectionLines.push(`C: "OO", ${modelId}, ${curveNodeId}`);
        ["X", "Y", "Z"].forEach((axis, axisIndex) => {
          const curveId = nextId++;
          objects.push(
            new FbxExportNode("AnimationCurve", [curveId, `AnimCurve::${channel.nodeName}_${spec.type}_${axis}`, "AnimationCurve"], [
              `KeyTime: ${spec.keys.map((key) => toTick(key.time)).join(",")}`,
              `KeyValueFloat: ${spec.keys.map((key) => key.values[axisIndex]).join(",")}`,
            ]),
          );
          connectionLines.push(`C: "OO", ${curveId}, ${curveNodeId}`);
        });
      });
    });
  });

  return nextId;
}

export class FBXExporter implements BaseExporter {
  getSupportedExtensions(): string[] {
    return ["fbx"];
  }

  write(scene: AiScene, _settings?: ExportSettings): ArrayBuffer {
    const objects: FbxExportNode[] = [];
    const connectionLines: string[] = [];
    const materialIdMap = new Map<number, number>();
    const modelIdMap = new Map<string, number>();
    let nextId = BASE_NODE_ID;

    scene.meshes.forEach((mesh, meshIndex) => {
      const geometryId = nextId++;
      const modelId = nextId++;
      objects.push(
        new FbxExportNode(
          "Geometry",
          [geometryId, `Geometry::${mesh.name || `Mesh_${meshIndex}`}`, "Mesh"],
          [
            `Vertices: ${flattenVertices(mesh)}`,
            `PolygonVertexIndex: ${flattenPolygonIndices(mesh)}`,
            `Normals: ${flattenNormals(mesh)}`,
            `UV: ${flattenUvs(mesh)}`,
          ],
        ),
      );
      objects.push(new FbxExportNode("Model", [modelId, `Model::${mesh.name || `Mesh_${meshIndex}`}`, "Model"]));
      modelIdMap.set(mesh.name || `Mesh_${meshIndex}`, modelId);
      connectionLines.push(`C: "OO", ${modelId}, ${geometryId}`);
      connectionLines.push(`C: "OO", ${modelId}, ${ROOT_MODEL_ID}`);

      if (!materialIdMap.has(mesh.materialIndex)) {
        const materialId = nextId++;
        materialIdMap.set(mesh.materialIndex, materialId);
        objects.push(renderMaterialNode(materialId, scene.materials[mesh.materialIndex]?.name ?? `Material_${mesh.materialIndex}`));
      }
      connectionLines.push(`C: "OO", ${materialIdMap.get(mesh.materialIndex)}, ${modelId}`);

      if (mesh.bones.length > 0) {
        const skinId = nextId++;
        objects.push(new FbxExportNode("Deformer", [skinId, `Deformer::Skin_${meshIndex}`, "Skin"]));
        connectionLines.push(`C: "OO", ${skinId}, ${geometryId}`);
        mesh.bones.forEach((bone, boneIndex) => {
          const clusterId = nextId++;
          const boneModelId = nextId++;
          objects.push(
            new FbxExportNode("Deformer", [clusterId, `SubDeformer::${bone.name}`, "Cluster"], [
              `Indexes: ${flattenBoneIndexes(mesh, boneIndex)}`,
              `Weights: ${flattenBoneWeights(mesh, boneIndex)}`,
              `TransformMatrix: ${flattenMatrix(mesh, boneIndex)}`,
            ]),
          );
          objects.push(new FbxExportNode("Model", [boneModelId, `Model::${bone.name}`, "LimbNode"]));
          modelIdMap.set(bone.name, boneModelId);
          connectionLines.push(`C: "OO", ${clusterId}, ${skinId}`);
          connectionLines.push(`C: "OO", ${boneModelId}, ${clusterId}`);
        });
      }

      if (mesh.morphTargets.length > 0) {
        const blendShapeId = nextId++;
        objects.push(new FbxExportNode("Deformer", [blendShapeId, `Deformer::BlendShape_${meshIndex}`, "BlendShape"]));
        connectionLines.push(`C: "OO", ${blendShapeId}, ${geometryId}`);
        mesh.morphTargets.forEach((morphTarget, morphIndex) => {
          const channelId = nextId++;
          const shapeId = nextId++;
          objects.push(new FbxExportNode("Deformer", [channelId, `SubDeformer::${morphTarget.name}`, "BlendShapeChannel"]));
          objects.push(
            new FbxExportNode("Geometry", [shapeId, `Geometry::${morphTarget.name}`, "Shape"], [
              `Indexes: ${flattenShapeIndexes(mesh, morphIndex)}`,
              `Vertices: ${flattenShapeVertices(mesh, morphIndex)}`,
            ]),
          );
          connectionLines.push(`C: "OO", ${channelId}, ${blendShapeId}`);
          connectionLines.push(`C: "OO", ${shapeId}, ${channelId}`);
        });
      }
    });

    objects.push(new FbxExportNode("Model", [ROOT_MODEL_ID, "Model::Root", "Model"]));
    modelIdMap.set("Root", ROOT_MODEL_ID);
    modelIdMap.set(scene.rootNode.name, ROOT_MODEL_ID);
    nextId = writeAnimations(scene.animations, modelIdMap, objects, connectionLines, nextId);

    const text = [
      "; FBX 7.4.0 project file",
      "; Created by nexus-fbx",
      "FBXHeaderExtension: {",
      "  FBXVersion: 7400",
      "}",
      new FbxExportNode("GlobalSettings", [], [
        "UpAxis: 1",
        "UpAxisSign: 1",
        "FrontAxis: 2",
        "FrontAxisSign: 1",
        "CoordAxis: 0",
        "CoordAxisSign: 1",
        "UnitScaleFactor: 1.0",
      ]).render(),
      new FbxExportNode("Objects", [], [], objects).render(),
      new FbxExportNode("Connections", [], connectionLines).render(),
      "Takes: {",
      "}",
    ].join("\n");

    return new TextEncoder().encode(text).buffer;
  }
}

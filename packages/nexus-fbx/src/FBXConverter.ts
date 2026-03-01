import {
  AiMetadataType,
  AiAnimBehaviour,
  AiPrimitiveType,
  AiSceneFlags,
  createIdentityMatrix4x4,
  type AiAnimation,
  type AiMesh,
  type AiMatrix4x4,
  type AiNode,
  type AiNodeAnim,
  type AiScene,
} from "nexus-core";
import { FbxAnimationStack, FbxBlendShape, FbxDocument, FbxSkin } from "./FBXDocument";
import { FBX_TICKS_PER_SECOND } from "./FBXTokenizer";

type CoordSystemInfo = {
  upAxis: number;
  upSign: number;
  frontAxis: number;
  frontSign: number;
  coordAxis: number;
  coordSign: number;
  unitScaleFactor: number;
};

function parseNumberList(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item));
  }
  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number);
}

export function buildAxisSwapMatrix(
  upAxis: number,
  upSign: number,
  frontAxis: number,
  frontSign: number,
  coordAxis: number,
  coordSign: number,
): AiMatrix4x4 {
  const basis = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  basis[0]![coordAxis] = coordSign;
  basis[1]![upAxis] = upSign;
  basis[2]![frontAxis] = frontSign;

  return {
    data: new Float32Array([
      basis[0]![0] ?? 0,
      basis[1]![0] ?? 0,
      basis[2]![0] ?? 0,
      0,
      basis[0]![1] ?? 0,
      basis[1]![1] ?? 0,
      basis[2]![1] ?? 0,
      0,
      basis[0]![2] ?? 0,
      basis[1]![2] ?? 0,
      basis[2]![2] ?? 0,
      0,
      0,
      0,
      0,
      1,
    ]),
  };
}

export function parseGlobalSettings(document: FbxDocument): CoordSystemInfo {
  const settings = document.root.children.find((child) => child.name === "GlobalSettings");
  const readNumber = (key: string, fallback: number): number => {
    const value = settings?.values[key]?.[0];
    return value === undefined ? fallback : Number(value);
  };
  return {
    upAxis: readNumber("UpAxis", 1),
    upSign: readNumber("UpAxisSign", 1),
    frontAxis: readNumber("FrontAxis", 2),
    frontSign: readNumber("FrontAxisSign", 1),
    coordAxis: readNumber("CoordAxis", 0),
    coordSign: readNumber("CoordAxisSign", 1),
    unitScaleFactor: readNumber("UnitScaleFactor", 100),
  };
}

function applyScale(matrix: AiMatrix4x4, factor: number): AiMatrix4x4 {
  const next = new Float32Array(matrix.data);
  for (let index = 0; index < 12; index += 1) {
    next[index] = (next[index] ?? 0) * factor;
  }
  return { data: next };
}

function quaternionFromEulerDegrees(x: number, y: number, z: number): { x: number; y: number; z: number; w: number } {
  const halfX = (x * Math.PI) / 360;
  const halfY = (y * Math.PI) / 360;
  const halfZ = (z * Math.PI) / 360;
  const sx = Math.sin(halfX);
  const cx = Math.cos(halfX);
  const sy = Math.sin(halfY);
  const cy = Math.cos(halfY);
  const sz = Math.sin(halfZ);
  const cz = Math.cos(halfZ);
  return {
    x: sx * cy * cz - cx * sy * sz,
    y: cx * sy * cz + sx * cy * sz,
    z: cx * cy * sz - sx * sy * cz,
    w: cx * cy * cz + sx * sy * sz,
  };
}

export class FBXConverter {
  convertAnimations(document: FbxDocument): AiAnimation[] {
    const stacks = [...document.objects.values()]
      .filter((object) => object.kind === "AnimationStack")
      .map((object) => new FbxAnimationStack(document, object));
    return stacks.map((stack) => {
      const channels = new Map<string, AiNodeAnim>();
      stack.layers.forEach((layer) => {
        layer.curveNodes.forEach((curveNode) => {
          const targetName = curveNode.linkedModel?.name ?? curveNode.name;
          const axisValues = new Map<string, { times: bigint[]; values: number[] }>();
          curveNode.curves.forEach((curve) => {
            const axis = curve.name.split("_").pop() ?? "X";
            axisValues.set(axis, {
              times: Array.from(curve.keyTimes),
              values: Array.from(curve.keyValues),
            });
          });
          const mergedTimes = [...new Set(Array.from(axisValues.values()).flatMap((axis) => axis.times.map((time) => time.toString())))].map(
            (time) => BigInt(time),
          );
          if (mergedTimes.length === 0) {
            return;
          }

          const channel =
            channels.get(targetName) ??
            (() => {
              const next: AiNodeAnim = {
                nodeName: targetName,
                positionKeys: [],
                rotationKeys: [],
                scalingKeys: [],
                preState: AiAnimBehaviour.DEFAULT,
                postState: AiAnimBehaviour.DEFAULT,
              };
              channels.set(targetName, next);
              return next;
            })();
          const nodeType = curveNode.name.includes("::R_")
            ? "R"
            : curveNode.name.includes("::S_")
              ? "S"
              : "T";
          mergedTimes.forEach((time) => {
            const seconds = Number(time) / Number(FBX_TICKS_PER_SECOND);
            const readAxis = (axis: string) => {
              const entry = axisValues.get(axis);
              const index = entry?.times.findIndex((candidate) => candidate === time) ?? -1;
              return index >= 0 ? Number(entry?.values[index] ?? 0) : 0;
            };
            if (nodeType === "T") {
              channel.positionKeys.push({ time: seconds, value: { x: readAxis("X"), y: readAxis("Y"), z: readAxis("Z") } });
            } else if (nodeType === "S") {
              channel.scalingKeys.push({ time: seconds, value: { x: readAxis("X"), y: readAxis("Y"), z: readAxis("Z") } });
            } else {
              channel.rotationKeys.push({ time: seconds, value: quaternionFromEulerDegrees(readAxis("X"), readAxis("Y"), readAxis("Z")) });
            }
          });
        });
      });
      return {
        name: stack.name || "Take001",
        duration: Number(stack.localStop - stack.localStart) / Number(FBX_TICKS_PER_SECOND),
        ticksPerSecond: 1,
        channels: [...channels.values()],
        meshChannels: [],
        morphMeshChannels: [],
      };
    });
  }

  convert(document: FbxDocument): AiScene {
    const coordInfo = parseGlobalSettings(document);
    const geometries = [...document.objects.values()].filter((object) => object.kind === "Mesh");
    const materials = [...document.objects.values()].filter((object) => object.kind === "Material");
    const models = [...document.objects.values()].filter((object) => object.kind === "Model");

    const meshes = geometries.map((geometry, geometryIndex) => {
      const vertices = parseNumberList(geometry.element.values.Vertices?.[0] ?? []).reduce<
        Array<{ x: number; y: number; z: number }>
      >((acc, value, index, all) => {
        if (index % 3 === 0) {
          acc.push({ x: value, y: all[index + 1] ?? 0, z: all[index + 2] ?? 0 });
        }
        return acc;
      }, []);
      const polygonIndex = parseNumberList(geometry.element.values.PolygonVertexIndex?.[0] ?? []);
      const faces: Array<{ indices: number[] }> = [];
      let current: number[] = [];
      polygonIndex.forEach((index) => {
        const isLast = index < 0;
        current.push(isLast ? Math.abs(index) - 1 : index);
        if (isLast) {
          faces.push({ indices: current });
          current = [];
        }
      });
      const normalNumbers = parseNumberList(geometry.element.values.Normals?.[0] ?? []);
      const uvNumbers = parseNumberList(geometry.element.values.UV?.[0] ?? []);
      const mesh: AiMesh = {
        name: String(geometry.properties.get("Name") ?? geometry.name),
        primitiveTypes: faces.some((face) => face.indices.length > 3)
          ? AiPrimitiveType.POLYGON
          : AiPrimitiveType.TRIANGLE,
        vertices,
        normals: normalNumbers.reduce<Array<{ x: number; y: number; z: number }>>((acc, value, index, all) => {
          if (index % 3 === 0) {
            acc.push({ x: value, y: all[index + 1] ?? 0, z: all[index + 2] ?? 0 });
          }
          return acc;
        }, []),
        tangents: [],
        bitangents: [],
        textureCoords: [
          uvNumbers.reduce<Array<{ x: number; y: number; z: number }>>((acc, value, index, all) => {
            if (index % 2 === 0) {
              acc.push({ x: value, y: all[index + 1] ?? 0, z: 0 });
            }
            return acc;
          }, []),
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
        colors: Array.from({ length: 8 }, () => null),
        faces,
        bones: [],
        materialIndex: materials.length > 0 ? Math.min(geometryIndex, materials.length - 1) : 0,
        morphTargets: [],
        aabb: {
          min: {
            x: Math.min(...vertices.map((vertex) => vertex.x)),
            y: Math.min(...vertices.map((vertex) => vertex.y)),
            z: Math.min(...vertices.map((vertex) => vertex.z)),
          },
          max: {
            x: Math.max(...vertices.map((vertex) => vertex.x)),
            y: Math.max(...vertices.map((vertex) => vertex.y)),
            z: Math.max(...vertices.map((vertex) => vertex.z)),
          },
        },
      };
      const skins = document
        .getChildObjects(geometry.id)
        .filter((object) => object.kind === "Skin")
        .map((object) => new FbxSkin(document, object));
      if (skins.length > 0) {
        const perVertex = new Map<number, Array<{ boneIdx: number; weight: number }>>();
        const bones = skins.flatMap((skin) =>
          skin.clusters.map((cluster, boneIdx) => {
            cluster.indexes.forEach((vertexId, index) => {
              const entries = perVertex.get(vertexId) ?? [];
              entries.push({ boneIdx, weight: Number(cluster.weights[index] ?? 0) });
              perVertex.set(vertexId, entries);
            });
            return {
              name: cluster.linkedModel?.name ?? cluster.name,
              weights: [] as Array<{ vertexId: number; weight: number }>,
              offsetMatrix: { data: Float32Array.from(cluster.transformMatrix, (value) => Number(value)) },
            };
          }),
        );
        perVertex.forEach((entries, vertexId) => {
          const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
          if (total <= 0) {
            return;
          }
          entries.forEach((entry) => {
            bones[entry.boneIdx]?.weights.push({ vertexId, weight: entry.weight / total });
          });
        });
        mesh.bones = bones;
      }
      const blendShapes = document
        .getChildObjects(geometry.id)
        .filter((object) => object.kind === "BlendShape")
        .map((object) => new FbxBlendShape(document, object));
      if (blendShapes.length > 0) {
        mesh.morphTargets = blendShapes.flatMap((blendShape) =>
          blendShape.channels.map((channel) => {
            const verticesCopy = mesh.vertices.map((vertex) => ({ ...vertex }));
            channel.shapeIndexes.forEach((vertexIndex, index) => {
              const base = vertexIndex * 3;
              verticesCopy[vertexIndex] = {
                x: (mesh.vertices[vertexIndex]?.x ?? 0) + Number(channel.shapeVertices[base] ?? 0),
                y: (mesh.vertices[vertexIndex]?.y ?? 0) + Number(channel.shapeVertices[base + 1] ?? 0),
                z: (mesh.vertices[vertexIndex]?.z ?? 0) + Number(channel.shapeVertices[base + 2] ?? 0),
              };
            });
            return {
              name: channel.name,
              vertices: verticesCopy,
              normals: mesh.normals.map((normal) => ({ ...normal })),
              tangents: [],
              bitangents: [],
              colors: Array.from({ length: 8 }, () => null),
              textureCoords: mesh.textureCoords.map((channelUvs) => channelUvs?.map((uv) => ({ ...uv })) ?? null),
              weight: 0,
            };
          }),
        );
      }
      return mesh;
    });

    const childNodes: AiNode[] = models.map((model, index) => ({
      name: model.name,
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [],
      meshIndices: meshes[index] ? [index] : [],
      metadata: null,
    }));
    const rootNode: AiNode = {
      name: "FBXRoot",
      transformation: applyScale(
        buildAxisSwapMatrix(
          coordInfo.upAxis,
          coordInfo.upSign,
          coordInfo.frontAxis,
          coordInfo.frontSign,
          coordInfo.coordAxis,
          coordInfo.coordSign,
        ),
        coordInfo.unitScaleFactor / 100,
      ),
      parent: null,
      children: childNodes,
      meshIndices: [],
      metadata: null,
    };
    childNodes.forEach((child) => {
      child.parent = rootNode;
    });

    return {
      flags: 0 as AiSceneFlags,
      rootNode,
      meshes,
      materials: materials.map((material) => ({
        name: material.name.replace(/^Material::/, ""),
        properties: [
          {
            key: "$clr.diffuse",
            semantic: 1,
            index: 0,
            type: 0,
            data: material.properties.get("DiffuseColor") ?? { r: 1, g: 1, b: 1, a: 1 },
          },
        ],
      })),
      animations: this.convertAnimations(document),
      textures: [],
      lights: [],
      cameras: [],
      metadata: {
        "nexus:unitScaleFactor": {
          type: AiMetadataType.FLOAT,
          data: coordInfo.unitScaleFactor / 100,
        },
      },
    };
  }
}

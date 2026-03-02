import {
  AiPropertyTypeInfo,
  AiTextureType,
  type AiAnimation,
  type AiMaterial,
  type AiMaterialProperty,
  type AiNode,
  type AiQuaternion,
  type AiScene,
  type BaseExporter,
  type ExportSettings,
} from "nexus-core";
import { FbxExportNode } from "./FBXExportNode";
import { FBX_TICKS_PER_SECOND } from "./FBXTokenizer";

const ROOT_MODEL_ID = 100000;
const BASE_NODE_ID = 100001;

type ExportNodeDescriptor = {
  node: AiNode;
  parent: AiNode | null;
};

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

function collectUvLines(mesh: AiScene["meshes"][number]): string[] {
  const lines = [`UV: ${flattenUvs(mesh)}`];
  mesh.textureCoords.slice(0, 8).forEach((channel, index) => {
    if (!channel) {
      return;
    }
    lines.push(`LayerElementUV: ${index} {`);
    lines.push(`  MappingInformationType: "ByVertice"`);
    lines.push(`  ReferenceInformationType: "Direct"`);
    lines.push(`  UV: ${channel.flatMap((uv) => [uv.x, uv.y]).join(",")}`);
    lines.push(`}`);
  });
  return lines;
}

function findMaterialProperty(material: AiMaterial | undefined, key: string, semantic?: AiTextureType): AiMaterialProperty | undefined {
  return material?.properties.find((property) => property.key === key && (semantic === undefined || property.semantic === semantic));
}

function getColorTuple(property: AiMaterialProperty | undefined, fallback: number[]): number[] {
  const value = property?.data as Partial<{ r: number; g: number; b: number; a: number }> | undefined;
  if (!value || typeof value !== "object") {
    return fallback;
  }
  return fallback.map((entry, index) => {
    if (index === 0) return Number(value.r ?? entry);
    if (index === 1) return Number(value.g ?? entry);
    if (index === 2) return Number(value.b ?? entry);
    return Number(value.a ?? entry);
  });
}

function getNumericProperty(material: AiMaterial | undefined, key: string, fallback: number): number {
  const value = findMaterialProperty(material, key)?.data;
  return typeof value === "number" ? value : fallback;
}

function getTextureBindings(material: AiMaterial | undefined): Array<Record<string, unknown>> {
  const bindings = material?.metadata?.textureBindings;
  return Array.isArray(bindings) ? (bindings as Array<Record<string, unknown>>) : [];
}

function findTextureBinding(material: AiMaterial | undefined, property: AiMaterialProperty, filename: string): Record<string, unknown> | undefined {
  return getTextureBindings(material).find((entry) => {
    const semantic = Number(entry.semantic ?? AiTextureType.DIFFUSE);
    const file = String(entry.file ?? entry.relativeFilename ?? "");
    return semantic === property.semantic && (file === filename || file === String(property.data ?? ""));
  });
}

function renderMaterialNode(id: number, material: AiMaterial | undefined): FbxExportNode {
  const name = material?.name ?? "Material";
  const shadingModel = String(material?.metadata?.fbxShadingModel ?? "Phong");
  const diffuse = getColorTuple(findMaterialProperty(material, "$clr.diffuse"), [0.8, 0.6, 0.4]);
  const specular = getColorTuple(findMaterialProperty(material, "$clr.specular"), [0.2, 0.2, 0.2]);
  const ambient = getColorTuple(findMaterialProperty(material, "$clr.ambient"), [0.0, 0.0, 0.0]);
  const opacity = getNumericProperty(material, "$mat.opacity", 1);
  const roughness = getNumericProperty(material, "$mat.roughness", 0);
  const metalness = getNumericProperty(material, "$mat.metalness", 0);
  return new FbxExportNode(
    "Material",
    [id, `Material::${name}`, "Material"],
    [`ShadingModel: "${shadingModel}"`],
    [
      new FbxExportNode("Properties70", [], [
        `P: "DiffuseColor", "Color", "", "A", ${diffuse[0]}, ${diffuse[1]}, ${diffuse[2]}`,
        `P: "SpecularColor", "Color", "", "A", ${specular[0]}, ${specular[1]}, ${specular[2]}`,
        `P: "AmbientColor", "Color", "", "A", ${ambient[0]}, ${ambient[1]}, ${ambient[2]}`,
        `P: "TransparencyFactor", "double", "", "A", ${1 - opacity}`,
        `P: "Maya|roughness", "double", "", "A", ${roughness}`,
        `P: "Metalness", "double", "", "A", ${metalness}`,
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

function texturePropertyName(semantic: AiTextureType): string {
  switch (semantic) {
    case AiTextureType.NORMALS:
      return "NormalMap";
    case AiTextureType.SPECULAR:
      return "SpecularColor";
    default:
      return "DiffuseColor";
  }
}

function parseJsonMetadata<T>(raw: unknown): T | null {
  if (typeof raw !== "string") {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readNodeTransformStack(node: AiNode): Record<string, unknown> | null {
  return parseJsonMetadata<Record<string, unknown>>(node.metadata?.["fbx:transformStack"]?.data);
}

function vectorFromUnknown(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (value && typeof value === "object") {
    const vector = value as Partial<{ x: number; y: number; z: number }>;
    return [Number(vector.x ?? fallback[0]), Number(vector.y ?? fallback[1]), Number(vector.z ?? fallback[2])];
  }
  return fallback;
}

function collectSceneNodes(root: AiNode): ExportNodeDescriptor[] {
  const collected: ExportNodeDescriptor[] = [];
  const visit = (node: AiNode, parent: AiNode | null): void => {
    collected.push({ node, parent });
    node.children.forEach((child) => visit(child, node));
  };
  root.children.forEach((child) => visit(child, root));
  return collected;
}

function renderModelProperties(node: AiNode): FbxExportNode[] {
  const userProperties = parseJsonMetadata<Array<{ name: string; type: string; value: unknown }>>(
    node.metadata?.["fbx:userProperties"]?.data,
  ) ?? [];
  const renderUserPropertyLines = (): string[] =>
    userProperties.map((entry) => {
      if (entry.value && typeof entry.value === "object") {
        const vector = entry.value as Partial<{ x: number; y: number; z: number }>;
        return `  P: "${entry.name}", "${entry.type || "Vector3D"}", "", "A", ${Number(vector.x ?? 0)}, ${Number(vector.y ?? 0)}, ${Number(vector.z ?? 0)}`;
      }
      if (typeof entry.value === "boolean") {
        return `  P: "${entry.name}", "${entry.type || "bool"}", "", "A", ${entry.value ? 1 : 0}`;
      }
      if (typeof entry.value === "number") {
        return `  P: "${entry.name}", "${entry.type || "double"}", "", "A", ${entry.value}`;
      }
      return `  P: "${entry.name}", "${entry.type || "KString"}", "", "A", "${String(entry.value ?? "")}"`;
    });

  const stack = readNodeTransformStack(node);
  if (stack) {
    const translation = vectorFromUnknown(stack.translation, [0, 0, 0]);
    const rotation = vectorFromUnknown(stack.rotation, [0, 0, 0]);
    const scaling = vectorFromUnknown(stack.scaling, [1, 1, 1]);
    const preRotation = vectorFromUnknown(stack.preRotation, [0, 0, 0]);
    const postRotation = vectorFromUnknown(stack.postRotation, [0, 0, 0]);
    const rotationPivot = vectorFromUnknown(stack.rotationPivot, [0, 0, 0]);
    const rotationOffset = vectorFromUnknown(stack.rotationOffset, [0, 0, 0]);
    const scalingPivot = vectorFromUnknown(stack.scalingPivot, [0, 0, 0]);
    const scalingOffset = vectorFromUnknown(stack.scalingOffset, [0, 0, 0]);
    const geometricTranslation = vectorFromUnknown(stack.geometricTranslation, [0, 0, 0]);
    const geometricRotation = vectorFromUnknown(stack.geometricRotation, [0, 0, 0]);
    const geometricScaling = vectorFromUnknown(stack.geometricScaling, [1, 1, 1]);
    const rotationOrder = Number(stack.rotationOrder === "ZYX" ? 5 : stack.rotationOrder === "ZXY" ? 4 : stack.rotationOrder === "YXZ" ? 3 : stack.rotationOrder === "YZX" ? 2 : stack.rotationOrder === "XZY" ? 1 : 0);
    return [
      new FbxExportNode("Properties70", [], [
      `  P: "Lcl Translation", "Lcl Translation", "", "A", ${translation[0]}, ${translation[1]}, ${translation[2]}`,
      `  P: "Lcl Rotation", "Lcl Rotation", "", "A", ${rotation[0]}, ${rotation[1]}, ${rotation[2]}`,
      `  P: "Lcl Scaling", "Lcl Scaling", "", "A", ${scaling[0]}, ${scaling[1]}, ${scaling[2]}`,
      `  P: "RotationOrder", "enum", "", "A", ${rotationOrder}`,
      `  P: "PreRotation", "Vector3D", "", "A", ${preRotation[0]}, ${preRotation[1]}, ${preRotation[2]}`,
      `  P: "PostRotation", "Vector3D", "", "A", ${postRotation[0]}, ${postRotation[1]}, ${postRotation[2]}`,
      `  P: "RotationPivot", "Vector3D", "", "A", ${rotationPivot[0]}, ${rotationPivot[1]}, ${rotationPivot[2]}`,
      `  P: "RotationOffset", "Vector3D", "", "A", ${rotationOffset[0]}, ${rotationOffset[1]}, ${rotationOffset[2]}`,
      `  P: "ScalingPivot", "Vector3D", "", "A", ${scalingPivot[0]}, ${scalingPivot[1]}, ${scalingPivot[2]}`,
      `  P: "ScalingOffset", "Vector3D", "", "A", ${scalingOffset[0]}, ${scalingOffset[1]}, ${scalingOffset[2]}`,
      `  P: "GeometricTranslation", "Vector3D", "", "A", ${geometricTranslation[0]}, ${geometricTranslation[1]}, ${geometricTranslation[2]}`,
      `  P: "GeometricRotation", "Vector3D", "", "A", ${geometricRotation[0]}, ${geometricRotation[1]}, ${geometricRotation[2]}`,
      `  P: "GeometricScaling", "Vector3D", "", "A", ${geometricScaling[0]}, ${geometricScaling[1]}, ${geometricScaling[2]}`,
      `  P: "InheritType", "int", "", "A", ${Number(stack.inheritType ?? 0)}`,
      ...renderUserPropertyLines(),
      ]),
    ];
  }

  return [
    new FbxExportNode("Properties70", [], [
      `  P: "Lcl Translation", "Lcl Translation", "", "A", ${node.transformation.data[12] ?? 0}, ${node.transformation.data[13] ?? 0}, ${node.transformation.data[14] ?? 0}`,
      ...renderUserPropertyLines(),
    ]),
  ];
}

function writeAnimations(
  scene: AiScene,
  animations: AiAnimation[],
  nodeIdMap: Map<string, number>,
  objects: FbxExportNode[],
  connectionLines: string[],
  nextId: number,
): number {
  const stackMetadata = parseJsonMetadata<
    Array<{ name: string; layers: Array<{ name: string }> }>
  >(scene.metadata["fbx:animationStacks"]?.data) ?? [];
  const cameraCurves = parseJsonMetadata<
    Array<{ animationName?: string; layerName?: string; objectName: string; propertyName: string; axes: Record<string, { times: number[]; values: number[] }> }>
  >(scene.metadata["fbx:cameraAnimationCurves"]?.data) ?? [];
  const lightCurves = parseJsonMetadata<
    Array<{ animationName?: string; layerName?: string; objectName: string; propertyName: string; axes: Record<string, { times: number[]; values: number[] }> }>
  >(scene.metadata["fbx:lightAnimationCurves"]?.data) ?? [];
  const blendShapeCurves = parseJsonMetadata<
    Array<{ animationName?: string; layerName?: string; objectName: string; propertyName: string; axes: Record<string, { times: number[]; values: number[] }> }>
  >(scene.metadata["fbx:blendShapeAnimationCurves"]?.data) ?? [];

  animations.forEach((animation, animationIndex) => {
    const stackId = nextId++;
    const layersForStack =
      stackMetadata.find((entry) => entry.name === animation.name)?.layers ??
      [{ name: animation.name || `Layer_${animationIndex}` }];
    const layerIds = layersForStack.map(() => nextId++);
    objects.push(
      new FbxExportNode("AnimationStack", [stackId, `AnimStack::${animation.name || `Take_${animationIndex}`}`, "AnimationStack"], [
        `LocalStart: 0`,
        `LocalStop: ${toTick(animation.duration)}`,
      ]),
    );
    layersForStack.forEach((layer, index) => {
      const layerId = layerIds[index]!;
      objects.push(new FbxExportNode("AnimationLayer", [layerId, `AnimLayer::${layer.name}`, "AnimationLayer"]));
      connectionLines.push(`C: "OO", ${layerId}, ${stackId}`);
    });
    const primaryLayerId = layerIds[0]!;

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
        connectionLines.push(`C: "OO", ${curveNodeId}, ${primaryLayerId}`);
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

    const propertyCurves = [
      ...cameraCurves
        .filter((entry) => !entry.animationName || entry.animationName === animation.name)
        .map((entry) => ({ ...entry, prefix: "CameraProperty" })),
      ...lightCurves
        .filter((entry) => !entry.animationName || entry.animationName === animation.name)
        .map((entry) => ({ ...entry, prefix: "LightProperty" })),
      ...blendShapeCurves
        .filter((entry) => !entry.animationName || entry.animationName === animation.name)
        .map((entry) => ({ ...entry, prefix: "BlendShapeProperty" })),
    ];
    propertyCurves.forEach((entry) => {
      const modelId = nodeIdMap.get(entry.objectName);
      if (!modelId) {
        return;
      }
      const targetLayerName = entry.layerName ?? layersForStack[0]?.name;
      const layerIndex = layersForStack.findIndex((layer) => layer.name === targetLayerName);
      const curveNodeId = nextId++;
      objects.push(
        new FbxExportNode(
          "AnimationCurveNode",
          [curveNodeId, `${entry.prefix}::${entry.objectName}::${entry.propertyName}`, "AnimationCurveNode"],
        ),
      );
      connectionLines.push(`C: "OO", ${curveNodeId}, ${layerIds[Math.max(layerIndex, 0)]!}`);
      connectionLines.push(`C: "OO", ${modelId}, ${curveNodeId}`);
      Object.entries(entry.axes).forEach(([axis, payload]) => {
        const curveId = nextId++;
        objects.push(
          new FbxExportNode("AnimationCurve", [curveId, `AnimCurve::${entry.objectName}_${entry.propertyName}_${axis}`, "AnimationCurve"], [
            `KeyTime: ${payload.times.map((time) => toTick(time)).join(",")}`,
            `KeyValueFloat: ${payload.values.join(",")}`,
          ]),
        );
        connectionLines.push(`C: "OO", ${curveId}, ${curveNodeId}`);
      });
    });

    animation.morphMeshChannels.forEach((channel) => {
      const meshOwner = scene.meshes.find((mesh) => mesh.morphTargets.some((target) => target.name === channel.name));
      const modelId = meshOwner ? nodeIdMap.get(meshOwner.name) : undefined;
      if (!modelId) {
        return;
      }
      const curveNodeId = nextId++;
      objects.push(
        new FbxExportNode(
          "AnimationCurveNode",
          [curveNodeId, `BlendShapeProperty::${channel.name}::DeformPercent`, "AnimationCurveNode"],
        ),
      );
      connectionLines.push(`C: "OO", ${curveNodeId}, ${primaryLayerId}`);
      connectionLines.push(`C: "OO", ${modelId}, ${curveNodeId}`);
      const curveId = nextId++;
      objects.push(
        new FbxExportNode("AnimationCurve", [curveId, `AnimCurve::${channel.name}_DeformPercent_X`, "AnimationCurve"], [
          `KeyTime: ${channel.keys.map((key) => toTick(key.time)).join(",")}`,
          `KeyValueFloat: ${channel.keys.map((key) => key.weights[0] ?? 0).join(",")}`,
        ]),
      );
      connectionLines.push(`C: "OO", ${curveId}, ${curveNodeId}`);
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
    const geometryIdMap = new Map<number, number>();
    const embeddedVideoIdMap = new Map<string, number>();
    const blendShapeMetadata = parseJsonMetadata<Array<{ meshName?: string; channelName?: string; deformPercent?: number; fullWeights?: number[] }>>(
      scene.metadata["fbx:blendShapeChannels"]?.data,
    ) ?? [];
    let nextId = BASE_NODE_ID;

    scene.textures.forEach((texture) => {
      const videoId = nextId++;
      embeddedVideoIdMap.set(texture.filename, videoId);
      objects.push(
        new FbxExportNode("Video", [videoId, `Video::${texture.filename}`, "Video"], [
          `RelativeFilename: "${texture.filename}"`,
          `Content: "${Array.from(texture.data).map((value) => value.toString(16).padStart(2, "0")).join("")}"`,
        ]),
      );
    });

    scene.meshes.forEach((mesh, meshIndex) => {
      const geometryId = nextId++;
      geometryIdMap.set(meshIndex, geometryId);
      objects.push(
        new FbxExportNode(
          "Geometry",
          [geometryId, `Geometry::${mesh.name || `Mesh_${meshIndex}`}`, "Mesh"],
          [
            `Vertices: ${flattenVertices(mesh)}`,
            `PolygonVertexIndex: ${flattenPolygonIndices(mesh)}`,
            `Normals: ${flattenNormals(mesh)}`,
            ...collectUvLines(mesh),
          ],
        ),
      );

      if (!materialIdMap.has(mesh.materialIndex)) {
        const materialId = nextId++;
        materialIdMap.set(mesh.materialIndex, materialId);
        const material = scene.materials[mesh.materialIndex];
        objects.push(renderMaterialNode(materialId, material));
        material?.properties
          .filter((property) => property.key === "$tex.file" && property.type === AiPropertyTypeInfo.STRING)
          .forEach((property) => {
            const textureId = nextId++;
            const rawFilename = String(property.data ?? "");
            const filename = rawFilename.startsWith("*")
              ? scene.textures[Number(rawFilename.slice(1))]?.filename ?? rawFilename
              : rawFilename;
            const textureBinding = findTextureBinding(material, property, filename);
            const relativeFilename = String(textureBinding?.relativeFilename ?? filename);
            objects.push(
              new FbxExportNode(
                "Texture",
                [textureId, `Texture::${filename}`, "TextureVideoClip"],
                [
                  `RelativeFilename: "${relativeFilename}"`,
                ],
                [
                  new FbxExportNode("Properties70", [], [
                    `P: "UVSet", "KString", "", "A", "${String(textureBinding?.uvSet ?? "map1")}"`,
                    `P: "Translation", "Vector3D", "", "A", ${Array.isArray(textureBinding?.translation) ? (textureBinding?.translation as number[]).join(", ") : "0, 0, 0"}`,
                    `P: "Scaling", "Vector3D", "", "A", ${Array.isArray(textureBinding?.scaling) ? (textureBinding?.scaling as number[]).join(", ") : "1, 1, 1"}`,
                    `P: "Rotation", "Vector3D", "", "A", ${Array.isArray(textureBinding?.rotation) ? (textureBinding?.rotation as number[]).join(", ") : "0, 0, 0"}`,
                    `P: "WrapModeU", "int", "", "A", ${Number(textureBinding?.wrapModeU ?? 0)}`,
                    `P: "WrapModeV", "int", "", "A", ${Number(textureBinding?.wrapModeV ?? 0)}`,
                    `P: "BlendMode", "KString", "", "A", "${String(textureBinding?.blendMode ?? "Normal")}"`,
                    `P: "Layered", "bool", "", "A", ${textureBinding?.layered ? 1 : 0}`,
                  ]),
                ],
              ),
            );
            connectionLines.push(`C: "OP", ${textureId}, ${materialId}, "${texturePropertyName(property.semantic)}"`);
            const videoId =
              embeddedVideoIdMap.get(rawFilename) ??
              embeddedVideoIdMap.get(filename) ??
              (() => {
                const createdVideoId = nextId++;
                embeddedVideoIdMap.set(filename, createdVideoId);
                objects.push(
                  new FbxExportNode("Video", [createdVideoId, `Video::${filename}`, "Video"], [
                    `RelativeFilename: "${filename}"`,
                  ]),
                );
                return createdVideoId;
              })();
            connectionLines.push(`C: "OO", ${videoId}, ${textureId}`);
          });
      }

      if (mesh.bones.length > 0) {
        const skinId = nextId++;
        const skinClusterMetadata = parseJsonMetadata<Record<string, unknown>>(mesh.bones[0]?.node?.metadata?.["fbx:skinCluster"]?.data);
        objects.push(
          new FbxExportNode("Deformer", [skinId, `Deformer::Skin_${meshIndex}`, "Skin"], [
            `SkinningType: "${String(skinClusterMetadata?.skinningType ?? "Linear")}"`,
            `DeformAccuracy: ${Number(skinClusterMetadata?.deformAccuracy ?? 0)}`,
          ]),
        );
        connectionLines.push(`C: "OO", ${skinId}, ${geometryId}`);
        mesh.bones.forEach((bone, boneIndex) => {
          const clusterId = nextId++;
          const boneModelId = nextId++;
          const clusterMetadata = parseJsonMetadata<Record<string, unknown>>(bone.node?.metadata?.["fbx:skinCluster"]?.data);
          const transformLinkMatrix = Array.isArray(clusterMetadata?.transformLinkMatrix)
            ? (clusterMetadata?.transformLinkMatrix as number[]).join(",")
            : flattenMatrix(mesh, boneIndex);
          objects.push(
            new FbxExportNode("Deformer", [clusterId, `SubDeformer::${bone.name}`, "Cluster"], [
              `Indexes: ${flattenBoneIndexes(mesh, boneIndex)}`,
              `Weights: ${flattenBoneWeights(mesh, boneIndex)}`,
              `TransformMatrix: ${flattenMatrix(mesh, boneIndex)}`,
              `TransformLinkMatrix: ${transformLinkMatrix}`,
              `LinkMode: "${String(clusterMetadata?.linkMode ?? "TotalOne")}"`,
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
          const channelMetadata = blendShapeMetadata.find(
            (entry) => (entry.meshName ?? mesh.name) === mesh.name && (entry.channelName ?? morphTarget.name) === morphTarget.name,
          );
          objects.push(
            new FbxExportNode("Deformer", [channelId, `SubDeformer::${morphTarget.name}`, "BlendShapeChannel"], [
              `DeformPercent: ${Number(channelMetadata?.deformPercent ?? morphTarget.weight ?? 0)}`,
              `FullWeights: ${(channelMetadata?.fullWeights ?? [morphTarget.weight ?? 0]).join(",")}`,
            ]),
          );
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

    const nodeDescriptors = collectSceneNodes(scene.rootNode);
    if (nodeDescriptors.length === 0 && scene.rootNode.meshIndices.length > 0) {
      scene.rootNode.meshIndices.forEach((meshIndex) => {
        const mesh = scene.meshes[meshIndex];
        nodeDescriptors.push({
          node: {
            name: mesh?.name ?? `${scene.rootNode.name}_Mesh_${meshIndex}`,
            transformation: scene.rootNode.transformation,
            parent: null,
            children: [],
            meshIndices: [meshIndex],
            metadata: scene.rootNode.metadata ?? null,
          },
          parent: scene.rootNode,
        });
      });
    }

    const sceneNodeIdMap = new Map<string, number>();
    nodeDescriptors.forEach(({ node }) => {
      const modelId = nextId++;
      sceneNodeIdMap.set(node.name, modelId);
      modelIdMap.set(node.name, modelId);
      objects.push(new FbxExportNode("Model", [modelId, `Model::${node.name}`, "Model"], [], renderModelProperties(node)));
    });

    nodeDescriptors.forEach(({ node, parent }) => {
      const modelId = sceneNodeIdMap.get(node.name);
      if (!modelId) {
        return;
      }
      const parentId = parent && parent !== scene.rootNode ? sceneNodeIdMap.get(parent.name) ?? ROOT_MODEL_ID : ROOT_MODEL_ID;
      connectionLines.push(`C: "OO", ${modelId}, ${parentId}`);
      node.meshIndices.forEach((meshIndex) => {
        const geometryId = geometryIdMap.get(meshIndex);
        const mesh = scene.meshes[meshIndex];
        if (!geometryId || !mesh) {
          return;
        }
        connectionLines.push(`C: "OO", ${geometryId}, ${modelId}`);
        const materialId = materialIdMap.get(mesh.materialIndex);
        if (materialId) {
          connectionLines.push(`C: "OO", ${materialId}, ${modelId}`);
        }
      });
    });

    scene.cameras.forEach((camera) => {
      let modelId = sceneNodeIdMap.get(camera.name);
      if (!modelId) {
        modelId = nextId++;
        sceneNodeIdMap.set(camera.name, modelId);
        modelIdMap.set(camera.name, modelId);
        objects.push(
          new FbxExportNode("Model", [modelId, `Model::${camera.name}`, "Model"], [
            `Properties70: {`,
            `  P: "Lcl Translation", "Lcl Translation", "", "A", ${camera.position.x}, ${camera.position.y}, ${camera.position.z}`,
            `}`,
          ]),
        );
        connectionLines.push(`C: "OO", ${modelId}, ${ROOT_MODEL_ID}`);
      }
      const cameraId = nextId++;
      const aspectHeight = camera.aspect === 0 ? 1 : 1;
      const aspectWidth = camera.aspect === 0 ? 1 : camera.aspect;
      objects.push(
        new FbxExportNode("Camera", [cameraId, `Camera::${camera.name}`, "Camera"], [
          `Properties70: {`,
          `  P: "FieldOfView", "double", "", "A", ${(camera.horizontalFov * 180) / Math.PI}`,
          `  P: "NearPlane", "double", "", "A", ${camera.clipPlaneNear}`,
          `  P: "FarPlane", "double", "", "A", ${camera.clipPlaneFar}`,
          `  P: "AspectWidth", "double", "", "A", ${aspectWidth}`,
          `  P: "AspectHeight", "double", "", "A", ${aspectHeight}`,
          `}`,
        ]),
      );
      connectionLines.push(`C: "OO", ${cameraId}, ${modelId}`);
    });

    scene.lights.forEach((light) => {
      let modelId = sceneNodeIdMap.get(light.name);
      if (!modelId) {
        modelId = nextId++;
        sceneNodeIdMap.set(light.name, modelId);
        modelIdMap.set(light.name, modelId);
        objects.push(
          new FbxExportNode("Model", [modelId, `Model::${light.name}`, "Model"], [
            `Properties70: {`,
            `  P: "Lcl Translation", "Lcl Translation", "", "A", ${light.position.x}, ${light.position.y}, ${light.position.z}`,
            `}`,
          ]),
        );
        connectionLines.push(`C: "OO", ${modelId}, ${ROOT_MODEL_ID}`);
      }
      const lightId = nextId++;
      const lightType = light.type === 3 ? 2 : light.type === 1 ? 1 : 0;
      objects.push(
        new FbxExportNode("Light", [lightId, `Light::${light.name}`, "Light"], [
          `Properties70: {`,
          `  P: "LightType", "int", "", "A", ${lightType}`,
          `  P: "Color", "Color", "", "A", ${light.diffuseColor.r}, ${light.diffuseColor.g}, ${light.diffuseColor.b}`,
          `  P: "InnerAngle", "double", "", "A", ${light.angleInnerCone}`,
          `  P: "OuterAngle", "double", "", "A", ${light.angleOuterCone}`,
          `}`,
        ]),
      );
      connectionLines.push(`C: "OO", ${lightId}, ${modelId}`);
    });

    const constraints = parseJsonMetadata<Array<{ name: string; type: string; sourceModels: string[]; targetModels: string[] }>>(
      scene.metadata["fbx:constraints"]?.data,
    ) ?? [];
    constraints.forEach((constraint) => {
      const constraintId = nextId++;
      objects.push(new FbxExportNode(constraint.type, [constraintId, constraint.name, constraint.type]));
      constraint.sourceModels.forEach((name) => {
        const modelId = sceneNodeIdMap.get(name);
        if (modelId) {
          connectionLines.push(`C: "OO", ${modelId}, ${constraintId}`);
        }
      });
      constraint.targetModels.forEach((name) => {
        const modelId = sceneNodeIdMap.get(name);
        if (modelId) {
          connectionLines.push(`C: "OO", ${constraintId}, ${modelId}`);
        }
      });
    });

    objects.push(new FbxExportNode("Model", [ROOT_MODEL_ID, "Model::Root", "Model"]));
    modelIdMap.set("Root", ROOT_MODEL_ID);
    modelIdMap.set(scene.rootNode.name, ROOT_MODEL_ID);
    nextId = writeAnimations(scene, scene.animations, modelIdMap, objects, connectionLines, nextId);

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

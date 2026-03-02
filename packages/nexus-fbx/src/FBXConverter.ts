import {
  AiMetadataType,
  AiAnimBehaviour,
  AiLightSourceType,
  AiPropertyTypeInfo,
  AiPrimitiveType,
  AiSceneFlags,
  AiTextureType,
  createEulerRotationMatrix4x4,
  createIdentityMatrix4x4,
  createScalingMatrix4x4,
  createTranslationMatrix4x4,
  determinant3x3FromMatrix4x4,
  invertMatrix4x4,
  multiplyMatrix4x4,
  type AiAnimation,
  type AiCamera,
  type AiLight,
  type AiMaterial,
  type AiMaterialProperty,
  type AiMetadata,
  type AiMesh,
  type AiMatrix4x4,
  type AiNode,
  type AiNodeAnim,
  type AiScene,
  type AiTexture,
  type AiVector3D,
} from "nexus-core";
import { FbxAnimationStack, FbxBlendShape, FbxDocument, FbxSkin, FbxVideo } from "./FBXDocument";
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

type FbxTransformStack = {
  translation: AiVector3D;
  rotation: AiVector3D;
  scaling: AiVector3D;
  rotationOrder: string;
  preRotation: AiVector3D;
  postRotation: AiVector3D;
  rotationPivot: AiVector3D;
  rotationOffset: AiVector3D;
  scalingPivot: AiVector3D;
  scalingOffset: AiVector3D;
  geometricTranslation: AiVector3D;
  geometricRotation: AiVector3D;
  geometricScaling: AiVector3D;
  inheritType: number;
  sourceModelId: string;
};

type FbxObject = FbxDocument["objects"] extends Map<bigint, infer T> ? T : never;

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

function vector3(x = 0, y = 0, z = 0): AiVector3D {
  return { x, y, z };
}

function metadataJson(data: unknown): { type: AiMetadataType; data: string } {
  return {
    type: AiMetadataType.AISTRING,
    data: JSON.stringify(data),
  };
}

function readPropertyVectorAsArray(values: { get(name: string): unknown }, name: string, fallback: [number, number, number]): [number, number, number] {
  const vector = readVectorProperty(values, name, vector3(fallback[0], fallback[1], fallback[2]));
  return [vector.x, vector.y, vector.z];
}

function readVectorProperty(
  values: { get(name: string): unknown },
  name: string,
  fallback = vector3(),
): AiVector3D {
  const value = values.get(name) as Partial<AiVector3D> | number[] | undefined;
  if (Array.isArray(value)) {
    return vector3(Number(value[0] ?? fallback.x), Number(value[1] ?? fallback.y), Number(value[2] ?? fallback.z));
  }
  if (value && typeof value === "object") {
    return vector3(Number(value.x ?? fallback.x), Number(value.y ?? fallback.y), Number(value.z ?? fallback.z));
  }
  return fallback;
}

function readNumberProperty(values: { get(name: string): unknown }, name: string, fallback = 0): number {
  const value = values.get(name);
  return value === undefined ? fallback : Number(value);
}

function rotationOrderFromValue(value: number): string {
  switch (value) {
    case 1:
      return "XZY";
    case 2:
      return "YZX";
    case 3:
      return "YXZ";
    case 4:
      return "ZXY";
    case 5:
      return "ZYX";
    default:
      return "XYZ";
  }
}

function composeTransformStack(stack: FbxTransformStack): AiMatrix4x4 {
  const localTranslation = createTranslationMatrix4x4(stack.translation.x, stack.translation.y, stack.translation.z);
  const rotationOffset = createTranslationMatrix4x4(stack.rotationOffset.x, stack.rotationOffset.y, stack.rotationOffset.z);
  const rotationPivot = createTranslationMatrix4x4(stack.rotationPivot.x, stack.rotationPivot.y, stack.rotationPivot.z);
  const inverseRotationPivot = invertMatrix4x4(rotationPivot);
  const scalingOffset = createTranslationMatrix4x4(stack.scalingOffset.x, stack.scalingOffset.y, stack.scalingOffset.z);
  const scalingPivot = createTranslationMatrix4x4(stack.scalingPivot.x, stack.scalingPivot.y, stack.scalingPivot.z);
  const inverseScalingPivot = invertMatrix4x4(scalingPivot);
  const preRotation = createEulerRotationMatrix4x4(
    stack.preRotation.x,
    stack.preRotation.y,
    stack.preRotation.z,
    stack.rotationOrder,
  );
  const rotation = createEulerRotationMatrix4x4(stack.rotation.x, stack.rotation.y, stack.rotation.z, stack.rotationOrder);
  const inversePostRotation = invertMatrix4x4(
    createEulerRotationMatrix4x4(stack.postRotation.x, stack.postRotation.y, stack.postRotation.z, stack.rotationOrder),
  );
  const scaling = createScalingMatrix4x4(stack.scaling.x, stack.scaling.y, stack.scaling.z);
  const geometricTranslation = createTranslationMatrix4x4(
    stack.geometricTranslation.x,
    stack.geometricTranslation.y,
    stack.geometricTranslation.z,
  );
  const geometricRotation = createEulerRotationMatrix4x4(
    stack.geometricRotation.x,
    stack.geometricRotation.y,
    stack.geometricRotation.z,
    stack.rotationOrder,
  );
  const geometricScaling = createScalingMatrix4x4(
    stack.geometricScaling.x,
    stack.geometricScaling.y,
    stack.geometricScaling.z,
  );

  return [
    localTranslation,
    rotationOffset,
    rotationPivot,
    preRotation,
    rotation,
    inversePostRotation,
    inverseRotationPivot,
    scalingOffset,
    scalingPivot,
    scaling,
    inverseScalingPivot,
    geometricTranslation,
    geometricRotation,
    geometricScaling,
  ].reduce((acc, matrix) => multiplyMatrix4x4(acc, matrix), createIdentityMatrix4x4());
}

function readTransformStack(
  model: FbxObject,
): FbxTransformStack {
  const properties = model.properties;
  return {
    translation: readVectorProperty(properties, "Lcl Translation"),
    rotation: readVectorProperty(properties, "Lcl Rotation"),
    scaling: readVectorProperty(properties, "Lcl Scaling", vector3(1, 1, 1)),
    rotationOrder: rotationOrderFromValue(readNumberProperty(properties, "RotationOrder", 0)),
    preRotation: readVectorProperty(properties, "PreRotation"),
    postRotation: readVectorProperty(properties, "PostRotation"),
    rotationPivot: readVectorProperty(properties, "RotationPivot"),
    rotationOffset: readVectorProperty(properties, "RotationOffset"),
    scalingPivot: readVectorProperty(properties, "ScalingPivot"),
    scalingOffset: readVectorProperty(properties, "ScalingOffset"),
    geometricTranslation: readVectorProperty(properties, "GeometricTranslation"),
    geometricRotation: readVectorProperty(properties, "GeometricRotation"),
    geometricScaling: readVectorProperty(properties, "GeometricScaling", vector3(1, 1, 1)),
    inheritType: readNumberProperty(properties, "InheritType", 0),
    sourceModelId: model.id.toString(),
  };
}

const KNOWN_MODEL_PROPERTIES = new Set([
  "Lcl Translation",
  "Lcl Rotation",
  "Lcl Scaling",
  "RotationOrder",
  "PreRotation",
  "PostRotation",
  "RotationPivot",
  "RotationOffset",
  "ScalingPivot",
  "ScalingOffset",
  "GeometricTranslation",
  "GeometricRotation",
  "GeometricScaling",
  "InheritType",
]);

function propertyEntryValue(entry: { type: string; values: Array<string | number | boolean> }): unknown {
  if (entry.type === "Color" || entry.type === "ColorRGB" || entry.type === "Vector3D") {
    return {
      x: Number(entry.values[0] ?? 0),
      y: Number(entry.values[1] ?? 0),
      z: Number(entry.values[2] ?? 0),
    };
  }
  if (entry.values.length === 1) {
    return entry.values[0];
  }
  return entry.values;
}

function collectUserProperties(model: FbxObject): Array<{ name: string; type: string; value: unknown }> {
  return model.properties.entries
    .filter((entry) => !KNOWN_MODEL_PROPERTIES.has(entry.name))
    .map((entry) => ({
      name: entry.name,
      type: entry.type,
      value: propertyEntryValue(entry),
    }));
}

function convertCamera(object: FbxObject, model: FbxObject | undefined): AiCamera {
  const modelProps = model?.properties;
  const cameraPosition = modelProps ? readVectorProperty(modelProps, "Lcl Translation") : vector3();
  const fov = Number(object.properties.get("FieldOfView") ?? object.properties.get("FOV") ?? 45);
  const nearPlane = Number(object.properties.get("NearPlane") ?? 0.1);
  const farPlane = Number(object.properties.get("FarPlane") ?? 1000);
  const aspectWidth = Number(object.properties.get("AspectWidth") ?? 16);
  const aspectHeight = Number(object.properties.get("AspectHeight") ?? 9);
  return {
    name: model?.name.replace(/^(Model|LimbNode)::/, "") ?? object.name.replace(/^Camera::/, ""),
    position: cameraPosition,
    up: vector3(0, 1, 0),
    lookAt: vector3(0, 0, -1),
    horizontalFov: (fov * Math.PI) / 180,
    clipPlaneNear: nearPlane,
    clipPlaneFar: farPlane,
    aspect: aspectHeight === 0 ? 1 : aspectWidth / aspectHeight,
  };
}

function convertLight(object: FbxObject, model: FbxObject | undefined): AiLight {
  const modelProps = model?.properties;
  const position = modelProps ? readVectorProperty(modelProps, "Lcl Translation") : vector3();
  const colorValue = object.properties.get("Color") as Partial<{ r: number; g: number; b: number }> | undefined;
  const color = {
    r: Number(colorValue?.r ?? 1),
    g: Number(colorValue?.g ?? 1),
    b: Number(colorValue?.b ?? 1),
  };
  const lightType = Number(object.properties.get("LightType") ?? 0);
  return {
    name: model?.name.replace(/^(Model|LimbNode)::/, "") ?? object.name.replace(/^Light::/, ""),
    type: lightType === 2 ? AiLightSourceType.SPOT : lightType === 1 ? AiLightSourceType.DIRECTIONAL : AiLightSourceType.POINT,
    position,
    direction: vector3(0, 0, -1),
    up: vector3(0, 1, 0),
    diffuseColor: color,
    specularColor: color,
    ambientColor: { r: 0, g: 0, b: 0 },
    angleInnerCone: Number(object.properties.get("InnerAngle") ?? 30),
    angleOuterCone: Number(object.properties.get("OuterAngle") ?? 45),
  };
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

function addMaterialProperty(properties: AiMaterialProperty[], key: string, semantic: AiTextureType, type: AiPropertyTypeInfo, data: unknown): void {
  properties.push({ key, semantic, index: 0, type, data });
}

function expandUvLayers(geometry: FbxDocument["objects"] extends Map<bigint, infer T> ? T : never, vertexCount: number): Array<Array<{ x: number; y: number; z: number }> | null> {
  const layers = Array.from({ length: 8 }, () => null as Array<{ x: number; y: number; z: number }> | null);
  const uvElements = geometry.element.children.filter((child) => child.name === "LayerElementUV");
  if (uvElements.length === 0) {
    const uvNumbers = parseNumberList(geometry.element.values.UV?.[0] ?? []);
    layers[0] = uvNumbers.reduce<Array<{ x: number; y: number; z: number }>>((acc, value, index, all) => {
      if (index % 2 === 0) {
        acc.push({ x: value, y: all[index + 1] ?? 0, z: 0 });
      }
      return acc;
    }, []);
    return layers;
  }

  uvElements.slice(0, 8).forEach((element, layerIndex) => {
    const uvNumbers = parseNumberList(element.values.UV?.[0] ?? []);
    const uvIndex = parseNumberList(element.values.UVIndex?.[0] ?? []);
    const mapping = String(element.values.MappingInformationType?.[0] ?? "ByPolygonVertex");
    const reference = String(element.values.ReferenceInformationType?.[0] ?? "Direct");
    const direct = uvNumbers.reduce<Array<{ x: number; y: number; z: number }>>((acc, value, index, all) => {
      if (index % 2 === 0) {
        acc.push({ x: value, y: all[index + 1] ?? 0, z: 0 });
      }
      return acc;
    }, []);

    if (mapping === "ByVertice") {
      layers[layerIndex] = Array.from({ length: vertexCount }, (_, vertexIndex) => {
        const sourceIndex = reference === "IndexToDirect" ? uvIndex[vertexIndex] ?? vertexIndex : vertexIndex;
        return direct[sourceIndex] ?? { x: 0, y: 0, z: 0 };
      });
      return;
    }

    layers[layerIndex] = Array.from({ length: vertexCount }, (_, vertexIndex) => {
      const sourceIndex = reference === "IndexToDirect" ? uvIndex[vertexIndex] ?? vertexIndex : vertexIndex;
      return direct[sourceIndex] ?? { x: 0, y: 0, z: 0 };
    });
  });

  return layers;
}

function convertMaterial(document: FbxDocument, materialObject: FbxDocument["objects"] extends Map<bigint, infer T> ? T : never, embeddedTextureLookup: Map<string, string>): AiMaterial {
  const properties: AiMaterialProperty[] = [];
  const table = materialObject.properties;
  table.entries.forEach((entry) => {
    switch (entry.name) {
      case "DiffuseColor":
        addMaterialProperty(properties, "$clr.diffuse", AiTextureType.DIFFUSE, AiPropertyTypeInfo.FLOAT, table.get(entry.name));
        break;
      case "SpecularColor":
        addMaterialProperty(properties, "$clr.specular", AiTextureType.SPECULAR, AiPropertyTypeInfo.FLOAT, table.get(entry.name));
        break;
      case "AmbientColor":
        addMaterialProperty(properties, "$clr.ambient", AiTextureType.AMBIENT, AiPropertyTypeInfo.FLOAT, table.get(entry.name));
        break;
      case "TransparencyFactor":
        addMaterialProperty(properties, "$mat.opacity", AiTextureType.OPACITY, AiPropertyTypeInfo.FLOAT, 1 - Number(entry.values[0] ?? 0));
        break;
      case "Maya|roughness":
        addMaterialProperty(properties, "$mat.roughness", AiTextureType.NONE, AiPropertyTypeInfo.FLOAT, Number(entry.values[0] ?? 0));
        break;
      case "Metalness":
        addMaterialProperty(properties, "$mat.metalness", AiTextureType.NONE, AiPropertyTypeInfo.FLOAT, Number(entry.values[0] ?? 0));
        break;
      default:
        break;
    }
  });

  const semanticFromConnection = (property: string): AiTextureType => {
    const lower = property.toLowerCase();
    if (lower.includes("normal")) {
      return AiTextureType.NORMALS;
    }
    if (lower.includes("specular")) {
      return AiTextureType.SPECULAR;
    }
    return AiTextureType.DIFFUSE;
  };

  document.getChildConnections(materialObject.id).forEach((connection) => {
    const textureObject = document.objects.get(connection.childId);
    if (!textureObject || !["Texture", "TextureVideoClip"].includes(textureObject.kind)) {
      return;
    }
    const videoObject = document.getChildObjects(textureObject.id).find((entry) => entry.kind === "Video");
    const relativeFilename = String(
      textureObject.element.values.RelativeFilename?.[0] ??
        videoObject?.element.values.RelativeFilename?.[0] ??
        videoObject?.name.replace(/^Video::/, "") ??
        "",
    );
    const resolvedFilename = embeddedTextureLookup.get(relativeFilename) ?? relativeFilename;
    if (!resolvedFilename) {
      return;
    }
    addMaterialProperty(properties, "$tex.file", semanticFromConnection(connection.property), AiPropertyTypeInfo.STRING, resolvedFilename);
  });

  if (!properties.some((property) => property.key === "$clr.diffuse")) {
    addMaterialProperty(properties, "$clr.diffuse", AiTextureType.DIFFUSE, AiPropertyTypeInfo.FLOAT, { r: 1, g: 1, b: 1, a: 1 });
  }

  return {
    name: materialObject.name.replace(/^Material::/, ""),
    properties,
  };
}

function collectAnimationMetadata(document: FbxDocument): {
  metadata: AiMetadata;
  diagnostics: Array<Record<string, unknown>>;
} {
  const stacks = [...document.objects.values()]
    .filter((object) => object.kind === "AnimationStack")
    .map((object) => new FbxAnimationStack(document, object));
  const stackMetadata = stacks.map((stack) => ({
    name: stack.name || "Take001",
    localStart: Number(stack.localStart),
    localStop: Number(stack.localStop),
    layers: stack.layers.map((layer) => ({
      name: layer.name,
      curveNodes: layer.curveNodes.map((curveNode) => ({
        name: curveNode.name,
        target: curveNode.linkedModel?.name ?? curveNode.name,
        rotationOrder: rotationOrderFromValue(Number(curveNode.linkedModel?.properties.get("RotationOrder") ?? 0)),
      })),
    })),
  }));

  const cameraCurves: Array<Record<string, unknown>> = [];
  const lightCurves: Array<Record<string, unknown>> = [];
  const diagnostics: Array<Record<string, unknown>> = [];

  stacks.forEach((stack) => {
    if (stack.layers.length > 1) {
      diagnostics.push({
        code: "FBX_ANIMATION_LAYER_MERGED",
        severity: "warning",
        capability: "fbx-animation",
        profile: "motionbuilder-fbx",
        message: `Animation stack ${stack.name} uses ${stack.layers.length} layers; normalized playback flattens them in IR channels.`,
      });
    }
    stack.layers.forEach((layer) => {
      layer.curveNodes.forEach((curveNode) => {
        const collectTarget = (prefix: "CameraProperty::" | "LightProperty::", sink: Array<Record<string, unknown>>): void => {
          if (!curveNode.name.startsWith(prefix)) {
            return;
          }
          const [, objectName = "", propertyName = ""] = curveNode.name.split("::");
          const axes = new Map<string, { times: number[]; values: number[] }>();
          curveNode.curves.forEach((curve) => {
            const axis = curve.name.split("_").pop() ?? "X";
            axes.set(axis, {
              times: Array.from(curve.keyTimes, (value) => Number(value) / Number(FBX_TICKS_PER_SECOND)),
              values: Array.from(curve.keyValues, (value) => Number(value)),
            });
          });
          sink.push({
            animationName: stack.name || "Take001",
            layerName: layer.name,
            objectName,
            propertyName,
            axes: Object.fromEntries(axes),
          });
        };
        collectTarget("CameraProperty::", cameraCurves);
        collectTarget("LightProperty::", lightCurves);
      });
    });
  });

  const metadata: AiMetadata = {};
  if (stackMetadata.length > 0) {
    metadata["fbx:animationStacks"] = metadataJson(stackMetadata);
  }
  if (cameraCurves.length > 0) {
    metadata["fbx:cameraAnimationCurves"] = metadataJson(cameraCurves);
  }
  if (lightCurves.length > 0) {
    metadata["fbx:lightAnimationCurves"] = metadataJson(lightCurves);
  }
  return { metadata, diagnostics };
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
          if (curveNode.name.startsWith("CameraProperty::") || curveNode.name.startsWith("LightProperty::")) {
            return;
          }
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
    const models = [...document.objects.values()].filter((object) => ["Model", "LimbNode", "Null"].includes(object.kind));
    const videos = [...document.objects.values()].filter((object) => object.kind === "Video").map((object) => new FbxVideo(object));
    const embeddedTextures: AiTexture[] = [];
    const embeddedTextureLookup = new Map<string, string>();
    videos.forEach((video, index) => {
      if (!video.content) {
        return;
      }
      const filename = `*${index}`;
      embeddedTextures.push({
        filename,
        width: 0,
        height: 0,
        formatHint: video.relativeFilename.split(".").pop() ?? "",
        data: new Uint8Array(video.content),
      });
      embeddedTextureLookup.set(video.relativeFilename, filename);
      embeddedTextureLookup.set(video.name, filename);
    });

    const geometryIndexMap = new Map<bigint, number>();
    const geometryParentCounts = new Map<bigint, number>();
    document.connectionRecords.forEach((connection) => {
      const child = document.objects.get(connection.childId);
      const parent = document.objects.get(connection.parentId);
      if (child?.kind === "Mesh" && parent && ["Model", "LimbNode", "Null"].includes(parent.kind)) {
        geometryParentCounts.set(child.id, (geometryParentCounts.get(child.id) ?? 0) + 1);
      }
    });

    const meshes = geometries.map((geometry, geometryIndex) => {
      geometryIndexMap.set(geometry.id, geometryIndex);
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
      const mesh: AiMesh = {
        name: String(geometry.properties.get("Name") ?? geometry.name).replace(/^Geometry::/, ""),
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
        textureCoords: expandUvLayers(geometry, vertices.length),
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

    const nodeById = new Map<bigint, AiNode>();
    models.forEach((model) => {
      const transformStack = readTransformStack(model);
      const userProperties = collectUserProperties(model);
      const linkedGeometryIds = document
        .getChildObjects(model.id)
        .filter((entry) => entry.kind === "Mesh")
        .map((entry) => entry.id);
      const meshIndices = linkedGeometryIds
        .map((geometryId) => geometryIndexMap.get(geometryId))
        .filter((entry): entry is number => entry !== undefined);
      const transformation = composeTransformStack(transformStack);
      const metadata: AiMetadata = {
        "fbx:transformStack": metadataJson(transformStack),
        "fbx:sourceModelId": {
          type: AiMetadataType.AISTRING,
          data: transformStack.sourceModelId,
        },
        "fbx:inheritsType": {
          type: AiMetadataType.INT32,
          data: transformStack.inheritType,
        },
        "fbx:mirrored": {
          type: AiMetadataType.BOOL,
          data: determinant3x3FromMatrix4x4(transformation) < 0,
        },
      };
      if (userProperties.length > 0) {
        metadata["fbx:userProperties"] = metadataJson(userProperties);
      }
      if (linkedGeometryIds.length > 0) {
        metadata["fbx:geometryIds"] = metadataJson(linkedGeometryIds.map((geometryId) => geometryId.toString()));
      }
      if (linkedGeometryIds.some((geometryId) => (geometryParentCounts.get(geometryId) ?? 0) > 1)) {
        metadata["fbx:instanceOf"] = metadataJson(
          linkedGeometryIds
            .filter((geometryId) => (geometryParentCounts.get(geometryId) ?? 0) > 1)
            .map((geometryId) => geometryId.toString()),
        );
      }
      nodeById.set(model.id, {
        name: model.name.replace(/^(Model|LimbNode)::/, ""),
        transformation,
        parent: null,
        children: [],
        meshIndices,
        metadata,
      });
    });

    const childNodes: AiNode[] = [];
    models.forEach((model) => {
      const node = nodeById.get(model.id);
      if (!node) {
        return;
      }
      const parentNode = document
        .getParentObjects(model.id)
        .find((entry) => ["Model", "LimbNode", "Null"].includes(entry.kind));
      if (parentNode) {
        const parent = nodeById.get(parentNode.id);
        if (parent) {
          node.parent = parent;
          parent.children.push(node);
          return;
        }
      }
      childNodes.push(node);
    });
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

    const cameras = [...document.objects.values()]
      .filter((object) => object.kind === "Camera")
      .map((camera) => {
        const parentModel = document.getParentObjects(camera.id).find((entry) => ["Model", "LimbNode", "Null"].includes(entry.kind));
        return convertCamera(camera, parentModel);
      });
    const lights = [...document.objects.values()]
      .filter((object) => object.kind === "Light")
      .map((light) => {
        const parentModel = document.getParentObjects(light.id).find((entry) => ["Model", "LimbNode", "Null"].includes(entry.kind));
        return convertLight(light, parentModel);
      });

    const supportedConstraints = new Set(["ConstraintAim", "ConstraintParent"]);
    const constraints = [...document.objects.values()]
      .filter((object) => object.kind.startsWith("Constraint"))
      .map((object) => {
        const parents = document.getParentObjects(object.id).filter((entry) => ["Model", "LimbNode", "Null"].includes(entry.kind));
        const children = document.getChildObjects(object.id).filter((entry) => ["Model", "LimbNode", "Null"].includes(entry.kind));
        return {
          name: object.name,
          type: object.kind,
          sourceModels: parents.map((entry) => entry.name.replace(/^(Model|LimbNode)::/, "")),
          targetModels: children.map((entry) => entry.name.replace(/^(Model|LimbNode)::/, "")),
        };
      });
    const diagnostics = constraints
      .filter((constraint) => !supportedConstraints.has(constraint.type))
      .map((constraint) => ({
        code: "FBX_UNSUPPORTED_SCENE_EXTRA",
        severity: "warning",
        capability: "fbx-scene-extras",
        profile: "maya-fbx",
        message: `Unsupported constraint type preserved as metadata: ${constraint.type}`,
        details: constraint,
      }));

    const animationMetadata = collectAnimationMetadata(document);
    return {
      flags: 0 as AiSceneFlags,
      rootNode,
      meshes,
      materials: materials.map((material) => convertMaterial(document, material, embeddedTextureLookup)),
      animations: this.convertAnimations(document),
      textures: embeddedTextures,
      lights,
      cameras,
      metadata: {
        ...animationMetadata.metadata,
        ...(animationMetadata.diagnostics.length > 0
          ? {
              "nexus:compatDiagnostics": metadataJson([
                ...animationMetadata.diagnostics,
                ...diagnostics,
              ]),
            }
          : diagnostics.length > 0
            ? {
                "nexus:compatDiagnostics": metadataJson(diagnostics),
              }
            : {}),
        ...(constraints.length > 0
          ? {
              "fbx:constraints": metadataJson(constraints),
            }
          : {}),
        "fbx:sourceCoordSystem": metadataJson(coordInfo),
        "nexus:unitScaleFactor": {
          type: AiMetadataType.FLOAT,
          data: coordInfo.unitScaleFactor / 100,
        },
      },
    };
  }
}

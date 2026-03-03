import { AiAnimBehaviour, AiMetadataType, AiSceneFlags, createIdentityMatrix4x4, createTranslationMatrix4x4, type AiAnimation, type AiNode, type AiNodeAnim, type AiQuaternion, type AiScene, type BaseImporter, type ImportResult, type ImportSettings } from "@3d-nexus/core";
import { BVHParser, countChannels, type BvhJoint } from "./BVHParser";

type JointChannelLayout = {
  name: string;
  type: BvhJoint["type"];
  channelCount: number;
  channels: string[];
  rotationOrder: string | null;
  startIndex: number;
};

function metadataJson(data: unknown) {
  return {
    type: AiMetadataType.AISTRING,
    data: JSON.stringify(data),
  };
}

function axisQuaternion(axis: "X" | "Y" | "Z", degrees: number): AiQuaternion {
  const halfAngle = (degrees * Math.PI) / 360;
  const s = Math.sin(halfAngle);
  const c = Math.cos(halfAngle);
  if (axis === "X") {
    return { x: s, y: 0, z: 0, w: c };
  }
  if (axis === "Y") {
    return { x: 0, y: s, z: 0, w: c };
  }
  return { x: 0, y: 0, z: s, w: c };
}

function multiplyQuaternions(left: AiQuaternion, right: AiQuaternion): AiQuaternion {
  return {
    x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
    y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
    z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
    w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z,
  };
}

function normalizeQuaternion(quaternion: AiQuaternion): AiQuaternion {
  const length = Math.hypot(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  if (!length) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }
  return {
    x: quaternion.x / length,
    y: quaternion.y / length,
    z: quaternion.z / length,
    w: quaternion.w / length,
  };
}

function quaternionFromChannels(channels: string[], values: number[]): AiQuaternion {
  const rotationChannels = channels
    .map((channel, index) => ({ channel, value: Number(values[index] ?? 0) }))
    .filter((entry) => entry.channel.endsWith("rotation"));

  return normalizeQuaternion(
    rotationChannels.reduce<AiQuaternion>(
      (current, entry) => multiplyQuaternions(current, axisQuaternion(entry.channel[0] as "X" | "Y" | "Z", entry.value)),
      { x: 0, y: 0, z: 0, w: 1 },
    ),
  );
}

function readChannelValue(channels: string[], values: number[], channelName: string): number {
  const index = channels.indexOf(channelName);
  return index >= 0 ? Number(values[index] ?? 0) : 0;
}

function createNodeTree(joint: BvhJoint, parent: AiNode | null): AiNode {
  const node: AiNode = {
    name: joint.name,
    transformation: createTranslationMatrix4x4(joint.offset[0], joint.offset[1], joint.offset[2]),
    parent,
    children: [],
    meshIndices: [],
    metadata: {
      "bvh:jointType": {
        type: AiMetadataType.AISTRING,
        data: joint.type,
      },
      "bvh:offset": metadataJson(joint.offset),
      "bvh:channels": metadataJson(joint.channels),
      "bvh:channelCount": {
        type: AiMetadataType.INT32,
        data: joint.channelCount,
      },
      "bvh:rotationOrder": {
        type: AiMetadataType.AISTRING,
        data: joint.rotationOrder ?? "",
      },
    },
  };
  node.children = joint.children.map((child) => createNodeTree(child, node));
  return node;
}

function collectAnimatedJoints(joint: BvhJoint, output: BvhJoint[] = []): BvhJoint[] {
  if (joint.channels.length > 0) {
    output.push(joint);
  }
  joint.children.forEach((child) => collectAnimatedJoints(child, output));
  return output;
}

export class BVHImporter implements BaseImporter {
  private readonly parser = new BVHParser();

  canRead(buffer: ArrayBuffer, filename: string): boolean {
    if (!filename.toLowerCase().endsWith(".bvh")) {
      return false;
    }
    const text = new TextDecoder().decode(buffer.slice(0, 64));
    return text.includes("HIERARCHY") && text.includes("ROOT");
  }

  read(buffer: ArrayBuffer, _filename: string, _settings?: ImportSettings): ImportResult {
    const document = this.parser.parse(buffer);
    const hierarchyRoot = createNodeTree(document.root, null);
    const rootNode: AiNode = {
      name: document.root.name || "BVHRoot",
      transformation: createIdentityMatrix4x4(),
      parent: null,
      children: [hierarchyRoot],
      meshIndices: [],
      metadata: null,
    };
    hierarchyRoot.parent = rootNode;

    const joints = collectAnimatedJoints(document.root);
    let cursor = 0;
    const jointLayouts: JointChannelLayout[] = [];
    const channels: AiNodeAnim[] = joints.map((joint) => {
      const jointCursor = cursor;
      cursor += joint.channels.length;
      jointLayouts.push({
        name: joint.name,
        type: joint.type,
        channelCount: joint.channelCount,
        channels: [...joint.channels],
        rotationOrder: joint.rotationOrder,
        startIndex: jointCursor,
      });

      return {
        nodeName: joint.name,
        positionKeys: document.motionValues.map((frameValues, frameIndex) => ({
          time: frameIndex,
          value: (() => {
            const jointValues = frameValues.slice(jointCursor, jointCursor + joint.channels.length);
            return {
              x: readChannelValue(joint.channels, jointValues, "Xposition"),
              y: readChannelValue(joint.channels, jointValues, "Yposition"),
              z: readChannelValue(joint.channels, jointValues, "Zposition"),
            };
          })(),
        })),
        rotationKeys: document.motionValues.map((frameValues, frameIndex) => ({
          time: frameIndex,
          value: {
            ...quaternionFromChannels(
              joint.channels,
              frameValues.slice(jointCursor, jointCursor + joint.channels.length),
            ),
          },
        })),
        scalingKeys: [],
        preState: AiAnimBehaviour.DEFAULT,
        postState: AiAnimBehaviour.DEFAULT,
      };
    });

    const animation: AiAnimation = {
      name: `${document.root.name || "BVH"}Motion`,
      duration: Math.max(0, document.frameCount - 1),
      ticksPerSecond: document.frameTime > 0 ? 1 / document.frameTime : 30,
      channels,
      meshChannels: [],
      morphMeshChannels: [],
    };

    const scene: AiScene = {
      flags: AiSceneFlags.AI_SCENE_FLAGS_INCOMPLETE,
      rootNode,
      meshes: [],
      materials: [],
      animations: [animation],
      textures: [],
      lights: [],
      cameras: [],
      metadata: {
        "bvh:frameTime": {
          type: AiMetadataType.AISTRING,
          data: String(document.frameTime),
        },
        "bvh:frameCount": {
          type: AiMetadataType.AISTRING,
          data: String(document.frameCount),
        },
        "bvh:channelCount": {
          type: AiMetadataType.AISTRING,
          data: String(countChannels(document.root)),
        },
        "bvh:motionValues": metadataJson(document.motionValues),
        "bvh:frameIndices": metadataJson(Array.from({ length: document.frameCount }, (_, frameIndex) => frameIndex)),
        "bvh:jointChannelLayout": metadataJson(jointLayouts),
      },
    };

    return { scene, warnings: [] };
  }
}


import { AiAnimBehaviour, AiMetadataType, AiSceneFlags, createIdentityMatrix4x4, type AiAnimation, type AiNode, type AiNodeAnim, type AiScene, type BaseImporter, type ImportResult, type ImportSettings } from "nexus-core";
import { BVHParser, countChannels, type BvhJoint } from "./BVHParser";

function createNodeTree(joint: BvhJoint, parent: AiNode | null): AiNode {
  const node: AiNode = {
    name: joint.name,
    transformation: createIdentityMatrix4x4(),
    parent,
    children: [],
    meshIndices: [],
    metadata: {
      "bvh:jointType": {
        type: AiMetadataType.AISTRING,
        data: joint.type,
      },
      "bvh:offset": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify(joint.offset),
      },
      "bvh:channels": {
        type: AiMetadataType.AISTRING,
        data: JSON.stringify(joint.channels),
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
    const channels: AiNodeAnim[] = joints.map((joint) => {
      const jointCursor = cursor;
      cursor += joint.channels.length;
      return {
        nodeName: joint.name,
        positionKeys: document.motionValues.map((frameValues, frameIndex) => ({
          time: frameIndex,
          value: {
            x: Number(frameValues[jointCursor] ?? 0),
            y: Number(frameValues[jointCursor + 1] ?? 0),
            z: Number(frameValues[jointCursor + 2] ?? 0),
          },
        })),
        rotationKeys: [],
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
        "bvh:motionValues": {
          type: AiMetadataType.AISTRING,
          data: JSON.stringify(document.motionValues),
        },
      },
    };

    return { scene, warnings: [] };
  }
}

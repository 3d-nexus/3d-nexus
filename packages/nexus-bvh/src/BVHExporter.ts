import { type AiAnimation, type AiNode, type AiScene, type BaseExporter, type ExportSettings } from "nexus-core";

type BvhJointType = "ROOT" | "JOINT" | "EndSite";

function readJson<T>(node: AiNode | null | undefined, key: string): T | null {
  const raw = node?.metadata?.[key]?.data;
  if (typeof raw !== "string") {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readNodeType(node: AiNode, isRoot: boolean): BvhJointType {
  const raw = node.metadata?.["bvh:jointType"]?.data;
  if (raw === "EndSite") {
    return "EndSite";
  }
  if (raw === "JOINT") {
    return "JOINT";
  }
  return isRoot ? "ROOT" : "JOINT";
}

function rotationChannelsFromOrder(order: string | null): string[] {
  const normalized = order && order.length === 3 ? order : "XYZ";
  return normalized.split("").map((axis) => `${axis}rotation`);
}

function readChannels(node: AiNode, isRoot: boolean): string[] {
  const metadataChannels = readJson<string[]>(node, "bvh:channels");
  if (metadataChannels && metadataChannels.length > 0) {
    return metadataChannels.map(String);
  }
  return isRoot
    ? ["Xposition", "Yposition", "Zposition", ...rotationChannelsFromOrder(null)]
    : rotationChannelsFromOrder(null);
}

function readOffset(node: AiNode): [number, number, number] {
  const metadataOffset = readJson<number[]>(node, "bvh:offset");
  if (metadataOffset && metadataOffset.length === 3) {
    return [Number(metadataOffset[0] ?? 0), Number(metadataOffset[1] ?? 0), Number(metadataOffset[2] ?? 0)];
  }
  const matrix = node.transformation.data;
  return [Number(matrix[12] ?? 0), Number(matrix[13] ?? 0), Number(matrix[14] ?? 0)];
}

function renderJoint(node: AiNode, depth: number, isRoot = false): string[] {
  const indent = "  ".repeat(depth);
  const type = readNodeType(node, isRoot);
  const offset = readOffset(node);

  if (type === "EndSite") {
    return [
      `${indent}End Site`,
      `${indent}{`,
      `${indent}  OFFSET ${offset[0]} ${offset[1]} ${offset[2]}`,
      `${indent}}`,
    ];
  }

  const channels = readChannels(node, isRoot);
  const lines = [
    `${indent}${isRoot ? "ROOT" : "JOINT"} ${node.name}`,
    `${indent}{`,
    `${indent}  OFFSET ${offset[0]} ${offset[1]} ${offset[2]}`,
    `${indent}  CHANNELS ${channels.length} ${channels.join(" ")}`,
  ];

  const structuralChildren = node.children.filter((child) => readNodeType(child, false) !== "EndSite");
  const endSiteChildren = node.children.filter((child) => readNodeType(child, false) === "EndSite");
  structuralChildren.forEach((child) => {
    lines.push(...renderJoint(child, depth + 1));
  });

  if (endSiteChildren.length > 0) {
    endSiteChildren.forEach((child) => {
      lines.push(...renderJoint(child, depth + 1));
    });
  } else if (structuralChildren.length === 0) {
    lines.push(`${indent}  End Site`);
    lines.push(`${indent}  {`);
    lines.push(`${indent}    OFFSET 0 0 0`);
    lines.push(`${indent}  }`);
  }

  lines.push(`${indent}}`);
  return lines;
}

function collectHierarchyNodes(node: AiNode, isRoot = false, output: Array<{ node: AiNode; channels: string[] }> = []): Array<{ node: AiNode; channels: string[] }> {
  const type = readNodeType(node, isRoot);
  if (type !== "EndSite") {
    output.push({ node, channels: readChannels(node, isRoot) });
    node.children.forEach((child) => collectHierarchyNodes(child, false, output));
  }
  return output;
}

function findVectorKey(animation: AiAnimation | undefined, nodeName: string, frameIndex: number) {
  const channel = animation?.channels.find((entry) => entry.nodeName === nodeName);
  const key = channel?.positionKeys.find((entry) => entry.time === frameIndex);
  return key?.value ?? { x: 0, y: 0, z: 0 };
}

function buildMotionValues(scene: AiScene, skeletonRoot: AiNode): number[][] {
  const metadataMotion = scene.metadata["bvh:motionValues"]?.data;
  if (typeof metadataMotion === "string") {
    try {
      const parsed = JSON.parse(metadataMotion) as number[][];
      if (Array.isArray(parsed) && parsed.every((frame) => Array.isArray(frame))) {
        return parsed.map((frame) => frame.map(Number));
      }
    } catch {
      // Fall through to canonical reconstruction.
    }
  }

  const animation = scene.animations[0];
  const frameCountRaw = scene.metadata["bvh:frameCount"]?.data;
  const frameCount = typeof frameCountRaw === "string"
    ? Number(frameCountRaw)
    : Math.max(
        1,
        ...((animation?.channels ?? []).flatMap((channel) => channel.positionKeys.map((key) => key.time + 1))),
      );
  const nodes = collectHierarchyNodes(skeletonRoot, true);
  const frames: number[][] = [];

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const row: number[] = [];
    nodes.forEach(({ node, channels }, nodeIndex) => {
      const position = findVectorKey(animation, node.name, frameIndex);
      channels.forEach((channel) => {
        if (channel === "Xposition") {
          row.push(position.x);
        } else if (channel === "Yposition") {
          row.push(position.y);
        } else if (channel === "Zposition") {
          row.push(position.z);
        } else {
          row.push(0);
        }
      });
      if (nodeIndex === 0 && channels.length === 0) {
        row.push(0, 0, 0, 0, 0, 0);
      }
    });
    frames.push(row);
  }

  return frames;
}

export class BVHExporter implements BaseExporter {
  getSupportedExtensions(): string[] {
    return ["bvh"];
  }

  write(scene: AiScene, _settings?: ExportSettings): ArrayBuffer {
    const skeletonRoot = scene.rootNode.children[0] ?? scene.rootNode;
    const frameTimeRaw = scene.metadata["bvh:frameTime"]?.data;
    const frameTime = typeof frameTimeRaw === "string" ? Number(frameTimeRaw) : 1 / 30;
    const frames = buildMotionValues(scene, skeletonRoot);
    const text = [
      "HIERARCHY",
      ...renderJoint(skeletonRoot, 0, true),
      "MOTION",
      `Frames: ${frames.length}`,
      `Frame Time: ${frameTime}`,
      ...frames.map((frame) => frame.join(" ")),
      "",
    ].join("\n");
    return new TextEncoder().encode(text).buffer;
  }
}

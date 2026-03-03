import { type AiNode, type AiScene, type BaseExporter, type ExportSettings } from "nexus-core";

function readJsonArray(node: AiNode, key: string, fallback: number[]): number[] {
  const raw = node.metadata?.[key]?.data;
  if (typeof raw !== "string") {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number) : fallback;
  } catch {
    return fallback;
  }
}

function readJsonStringArray(node: AiNode, key: string, fallback: string[]): string[] {
  const raw = node.metadata?.[key]?.data;
  if (typeof raw !== "string") {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return fallback;
  }
}

function renderJoint(node: AiNode, depth: number, isRoot = false): string[] {
  const indent = "  ".repeat(depth);
  const offset = readJsonArray(node, "bvh:offset", [0, 0, 0]);
  const channels = readJsonStringArray(
    node,
    "bvh:channels",
    isRoot ? ["Xposition", "Yposition", "Zposition", "Xrotation", "Yrotation", "Zrotation"] : ["Xrotation", "Yrotation", "Zrotation"],
  );
  const lines = [
    `${indent}${isRoot ? "ROOT" : "JOINT"} ${node.name}`,
    `${indent}{`,
    `${indent}  OFFSET ${offset[0] ?? 0} ${offset[1] ?? 0} ${offset[2] ?? 0}`,
    `${indent}  CHANNELS ${channels.length} ${channels.join(" ")}`,
  ];

  if (node.children.length === 0) {
    lines.push(`${indent}  End Site`);
    lines.push(`${indent}  {`);
    lines.push(`${indent}    OFFSET 0 0 0`);
    lines.push(`${indent}  }`);
  } else {
    node.children.forEach((child) => {
      lines.push(...renderJoint(child, depth + 1));
    });
  }

  lines.push(`${indent}}`);
  return lines;
}

function collectChannelCount(node: AiNode, isRoot = false): number {
  const channels = readJsonStringArray(
    node,
    "bvh:channels",
    isRoot ? ["Xposition", "Yposition", "Zposition", "Xrotation", "Yrotation", "Zrotation"] : ["Xrotation", "Yrotation", "Zrotation"],
  );
  return channels.length + node.children.reduce((sum, child) => sum + collectChannelCount(child), 0);
}

export class BVHExporter implements BaseExporter {
  getSupportedExtensions(): string[] {
    return ["bvh"];
  }

  write(scene: AiScene, _settings?: ExportSettings): ArrayBuffer {
    const skeletonRoot = scene.rootNode.children[0] ?? scene.rootNode;
    const frameTimeRaw = scene.metadata["bvh:frameTime"]?.data;
    const motionValuesRaw = scene.metadata["bvh:motionValues"]?.data;
    const frameTime = typeof frameTimeRaw === "string" ? Number(frameTimeRaw) : 1 / 30;
    const frameValues = typeof motionValuesRaw === "string" ? JSON.parse(motionValuesRaw) as number[][] : [];
    const channelCount = collectChannelCount(skeletonRoot, true);
    const frames = frameValues.length > 0 ? frameValues : [Array(channelCount).fill(0)];
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

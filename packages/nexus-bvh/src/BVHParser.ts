export interface BvhJoint {
  name: string;
  type: "ROOT" | "JOINT" | "EndSite";
  offset: [number, number, number];
  channelCount: number;
  channels: string[];
  rotationOrder: string | null;
  children: BvhJoint[];
}

export interface BvhDocument {
  root: BvhJoint;
  frameCount: number;
  frameTime: number;
  motionValues: number[][];
}

function linesFromBuffer(buffer: ArrayBuffer): string[] {
  return new TextDecoder().decode(buffer).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function parseVector(parts: string[], errorMessage: string): [number, number, number] {
  if (parts.length !== 4 || parts[0] !== "OFFSET") {
    throw new Error(errorMessage);
  }

  const values = parts.slice(1).map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(errorMessage);
  }

  return [values[0]!, values[1]!, values[2]!];
}

function parseRotationOrder(channels: string[]): string | null {
  const order = channels
    .filter((channel) => channel.endsWith("rotation"))
    .map((channel) => channel[0]?.toUpperCase() ?? "")
    .join("");

  return order.length > 0 ? order : null;
}

export class BVHParser {
  parse(buffer: ArrayBuffer): BvhDocument {
    const lines = linesFromBuffer(buffer);
    if (lines[0] !== "HIERARCHY") {
      throw new Error("Invalid BVH: missing HIERARCHY header");
    }

    let index = 1;

    const parseJoint = (): BvhJoint => {
      const jointLine = lines[index++];
      if (!jointLine) {
        throw new Error("Invalid BVH: unexpected end of hierarchy");
      }
      if (jointLine === "End Site") {
        if (lines[index++] !== "{") {
          throw new Error("Invalid BVH: missing End Site block");
        }
        const offsetLine = lines[index++];
        const offsetParts = offsetLine?.split(/\s+/) ?? [];
        if (lines[index++] !== "}") {
          throw new Error("Invalid BVH: unterminated End Site block");
        }
        return {
          name: "EndSite",
          type: "EndSite",
          offset: parseVector(offsetParts, "Invalid BVH: malformed End Site OFFSET"),
          channelCount: 0,
          channels: [],
          rotationOrder: null,
          children: [],
        };
      }

      const [type, ...nameParts] = jointLine.split(/\s+/);
      if (type !== "ROOT" && type !== "JOINT") {
        throw new Error(`Invalid BVH: unexpected joint line "${jointLine}"`);
      }
      if (lines[index++] !== "{") {
        throw new Error("Invalid BVH: missing joint block");
      }
      const offsetLine = lines[index++];
      const offsetParts = offsetLine?.split(/\s+/) ?? [];
      const channelLine = lines[index++];
      const channelParts = channelLine?.split(/\s+/) ?? [];
      if (channelParts[0] !== "CHANNELS" || channelParts.length < 2) {
        throw new Error("Invalid BVH: malformed CHANNELS");
      }
      const declaredCount = Number(channelParts[1] ?? 0);
      if (!Number.isInteger(declaredCount) || declaredCount < 0) {
        throw new Error("Invalid BVH: malformed CHANNELS");
      }
      const channels = channelParts.slice(2);
      if (channels.length !== declaredCount) {
        throw new Error("Invalid BVH: channel count mismatch");
      }

      const children: BvhJoint[] = [];
      while (index < lines.length && lines[index] !== "}") {
        if (lines[index] === "MOTION") {
          throw new Error("Invalid BVH: unterminated joint block");
        }
        children.push(parseJoint());
      }
      if (lines[index++] !== "}") {
        throw new Error("Invalid BVH: unterminated joint block");
      }
      return {
        name: nameParts.join(" "),
        type,
        offset: parseVector(offsetParts, "Invalid BVH: malformed OFFSET"),
        channelCount: declaredCount,
        channels,
        rotationOrder: parseRotationOrder(channels),
        children,
      };
    };

    const root = parseJoint();
    if (root.type !== "ROOT") {
      throw new Error("Invalid BVH: hierarchy must start with ROOT");
    }
    if (lines[index++] !== "MOTION") {
      throw new Error("Invalid BVH: missing MOTION section");
    }
    const framesLine = lines[index++] ?? "";
    const frameTimeLine = lines[index++] ?? "";
    const frameCountParts = framesLine.split(/[:\s]+/).filter(Boolean);
    const frameTimeParts = frameTimeLine.split(/[:\s]+/).filter(Boolean);
    const frameCount = Number(frameCountParts[frameCountParts.length - 1] ?? 0);
    const frameTime = Number(frameTimeParts[frameTimeParts.length - 1] ?? 0);
    if (!Number.isInteger(frameCount) || frameCount < 0) {
      throw new Error("Invalid BVH: malformed Frames line");
    }
    if (!Number.isFinite(frameTime) || frameTime <= 0) {
      throw new Error("Invalid BVH: malformed Frame Time line");
    }
    const channelCount = countChannels(root);
    const motionValues = lines.slice(index).map((line) => {
      const values = line.split(/\s+/).map(Number);
      if (values.some((value) => !Number.isFinite(value))) {
        throw new Error("Invalid BVH: malformed motion value");
      }
      if (values.length !== channelCount) {
        throw new Error("Invalid BVH: motion channel count mismatch");
      }
      return values;
    });
    if (motionValues.length !== frameCount) {
      throw new Error("Invalid BVH: frame count mismatch");
    }

    return {
      root,
      frameCount,
      frameTime,
      motionValues,
    };
  }
}

export function countChannels(joint: BvhJoint): number {
  return joint.channels.length + joint.children.reduce((sum, child) => sum + countChannels(child), 0);
}

export interface BvhJoint {
  name: string;
  type: "ROOT" | "JOINT" | "EndSite";
  offset: [number, number, number];
  channels: string[];
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
        if (offsetParts[0] !== "OFFSET" || offsetParts.length !== 4) {
          throw new Error("Invalid BVH: malformed End Site OFFSET");
        }
        if (lines[index++] !== "}") {
          throw new Error("Invalid BVH: unterminated End Site block");
        }
        return {
          name: "EndSite",
          type: "EndSite",
          offset: [Number(offsetParts[1]), Number(offsetParts[2]), Number(offsetParts[3])],
          channels: [],
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
      if (offsetParts[0] !== "OFFSET" || offsetParts.length !== 4) {
        throw new Error("Invalid BVH: malformed OFFSET");
      }
      const channelLine = lines[index++];
      const channelParts = channelLine?.split(/\s+/) ?? [];
      if (channelParts[0] !== "CHANNELS" || channelParts.length < 2) {
        throw new Error("Invalid BVH: malformed CHANNELS");
      }
      const declaredCount = Number(channelParts[1] ?? 0);
      const channels = channelParts.slice(2);
      if (channels.length !== declaredCount) {
        throw new Error("Invalid BVH: channel count mismatch");
      }

      const children: BvhJoint[] = [];
      while (index < lines.length && lines[index] !== "}") {
        children.push(parseJoint());
      }
      if (lines[index++] !== "}") {
        throw new Error("Invalid BVH: unterminated joint block");
      }
      return {
        name: nameParts.join(" "),
        type,
        offset: [Number(offsetParts[1]), Number(offsetParts[2]), Number(offsetParts[3])],
        channels,
        children,
      };
    };

    const root = parseJoint();
    if (lines[index++] !== "MOTION") {
      throw new Error("Invalid BVH: missing MOTION section");
    }
    const framesLine = lines[index++] ?? "";
    const frameTimeLine = lines[index++] ?? "";
    const frameCountParts = framesLine.split(/[:\s]+/).filter(Boolean);
    const frameTimeParts = frameTimeLine.split(/[:\s]+/).filter(Boolean);
    const frameCount = Number(frameCountParts[frameCountParts.length - 1] ?? 0);
    const frameTime = Number(frameTimeParts[frameTimeParts.length - 1] ?? 0);
    const channelCount = countChannels(root);
    const motionValues = lines.slice(index).map((line) => {
      const values = line.split(/\s+/).map(Number);
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

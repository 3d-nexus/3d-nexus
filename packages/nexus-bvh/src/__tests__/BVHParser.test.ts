import { describe, expect, it } from "vitest";

import { BVHParser, countChannels } from "../BVHParser";

function encodeBvh(source: string): ArrayBuffer {
  return new TextEncoder().encode(source.trim()).buffer;
}

describe("BVHParser", () => {
  it("parses hierarchy, channels, rotation order, and motion frames", () => {
    const parser = new BVHParser();
    const document = parser.parse(encodeBvh(`
      HIERARCHY
      ROOT Hips
      {
        OFFSET 0 0 0
        CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation
        JOINT Chest
        {
          OFFSET 0 10 0
          CHANNELS 3 Zrotation Xrotation Yrotation
          End Site
          {
            OFFSET 0 5 0
          }
        }
      }
      MOTION
      Frames: 2
      Frame Time: 0.0333333
      1 2 3 10 20 30 40 50 60
      4 5 6 11 21 31 41 51 61
    `));

    expect(document.root.name).toBe("Hips");
    expect(document.root.channelCount).toBe(6);
    expect(document.root.channels).toEqual([
      "Xposition",
      "Yposition",
      "Zposition",
      "Zrotation",
      "Xrotation",
      "Yrotation",
    ]);
    expect(document.root.rotationOrder).toBe("ZXY");
    expect(document.root.children[0]?.name).toBe("Chest");
    expect(document.root.children[0]?.rotationOrder).toBe("ZXY");
    expect(document.root.children[0]?.children[0]).toMatchObject({
      type: "EndSite",
      offset: [0, 5, 0],
      channelCount: 0,
      rotationOrder: null,
    });
    expect(document.frameCount).toBe(2);
    expect(document.frameTime).toBeCloseTo(0.0333333);
    expect(countChannels(document.root)).toBe(9);
    expect(document.motionValues).toEqual([
      [1, 2, 3, 10, 20, 30, 40, 50, 60],
      [4, 5, 6, 11, 21, 31, 41, 51, 61],
    ]);
  });

  it("rejects malformed hierarchies", () => {
    const parser = new BVHParser();

    expect(() =>
      parser.parse(encodeBvh(`
        HIERARCHY
        ROOT Hips
        {
          OFFSET 0 0 0
          CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation
          JOINT Chest
          {
            OFFSET 0 10 0
            CHANNELS 3 Zrotation Xrotation Yrotation
          }
        MOTION
        Frames: 0
        Frame Time: 0.0333333
      `)),
    ).toThrowError("Invalid BVH: unterminated joint block");
  });

  it("rejects mismatched declared channel counts", () => {
    const parser = new BVHParser();

    expect(() =>
      parser.parse(encodeBvh(`
        HIERARCHY
        ROOT Hips
        {
          OFFSET 0 0 0
          CHANNELS 6 Xposition Yposition Zposition Xrotation Yrotation
        }
        MOTION
        Frames: 1
        Frame Time: 0.0333333
        0 0 0 0 0 0
      `)),
    ).toThrowError("Invalid BVH: channel count mismatch");
  });

  it("rejects motion rows that do not match hierarchy channels", () => {
    const parser = new BVHParser();

    expect(() =>
      parser.parse(encodeBvh(`
        HIERARCHY
        ROOT Hips
        {
          OFFSET 0 0 0
          CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation
        }
        MOTION
        Frames: 1
        Frame Time: 0.0333333
        0 0 0 0 0
      `)),
    ).toThrowError("Invalid BVH: motion channel count mismatch");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MMDVmdParser } from "../MMDVmdParser";

describe("MMDVmdParser", () => {
  it("parses minimal VMD fixture", () => {
    const file = readFileSync(join(import.meta.dirname, "fixtures", "minimal.vmd"));
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const document = new MMDVmdParser().parse(buffer);

    expect(document.boneFrames).toHaveLength(1);
    expect(document.morphFrames).toHaveLength(1);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MMDPmxParser } from "../MMDPmxParser";

describe("MMDPmxParser", () => {
  it("parses minimal PMX fixture", () => {
    const file = readFileSync(join(import.meta.dirname, "fixtures", "minimal.pmx"));
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const document = new MMDPmxParser().parse(buffer);

    expect(document.vertices).toHaveLength(3);
    expect(document.bones).toHaveLength(1);
    expect(document.materials).toHaveLength(1);
  });

  it("rejects bad PMX magic", () => {
    const bad = new TextEncoder().encode("BAD ").buffer;
    expect(() => new MMDPmxParser().parse(bad)).toThrow(/Invalid PMX magic/);
  });
});

import { deflateSync } from "fflate";
import { describe, expect, it } from "vitest";
import { FBXBinaryTokenizer } from "../FBXBinaryTokenizer";
import { FBXBinaryWriter } from "../FBXBinaryWriter";
import type { FBXToken } from "../FBXTokenizer";

const magic = new TextEncoder().encode("Kaydara FBX Binary  \0\x1a\0");

function writeUint32(value: number): number[] {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, value, true);
  return Array.from(new Uint8Array(buffer));
}

function createCompressedArrayFixture(): ArrayBuffer {
  const values = new Int32Array([1, 2, 3, 4]);
  const payload = deflateSync(new Uint8Array(values.buffer));
  const name = new TextEncoder().encode("Vertices");
  const property = [..."i"].map((char) => char.charCodeAt(0));
  property.push(...writeUint32(values.length), ...writeUint32(1), ...writeUint32(payload.byteLength), ...payload);

  const recordStart = 27;
  const endOffset = recordStart + 4 + 4 + 4 + 1 + name.byteLength + property.length;
  return Uint8Array.from([
    ...magic,
    ...writeUint32(7400),
    ...writeUint32(endOffset),
    ...writeUint32(1),
    ...writeUint32(property.length),
    name.byteLength,
    ...name,
    ...property,
    ...Array(13).fill(0),
  ]).buffer;
}

describe("FBXBinaryTokenizer", () => {
  it("validates magic and decompresses array properties", () => {
    const tokenizer = new FBXBinaryTokenizer();
    const tokens = tokenizer.tokenize(createCompressedArrayFixture());

    expect(tokens[0]).toMatchObject({
      type: "Data",
      name: "Vertices",
      value: [1, 2, 3, 4],
    });
    expect(() => tokenizer.tokenize(new TextEncoder().encode("bad").buffer)).toThrow(/Invalid FBX binary magic/);
  });

  it("round-trips exported binary tokens", () => {
    const source: FBXToken[] = [
      { type: "NodeBegin", name: "FBXHeaderExtension", properties: [] },
      { type: "Data", name: "FBXVersion", value: 7400 },
      { type: "NodeEnd" },
      { type: "NodeBegin", name: "Objects", properties: [] },
      { type: "NodeBegin", name: "Model", properties: [100000, "Model::Root", "Model"] },
      { type: "NodeEnd" },
      { type: "NodeEnd" },
    ];
    const buffer = new FBXBinaryWriter().write(source);
    const header = new TextDecoder("ascii").decode(buffer.slice(0, 23));

    expect(header).toBe("Kaydara FBX Binary  \0\x1a\0");
    expect(new FBXBinaryTokenizer().tokenize(buffer)).toEqual(source);
  });
});

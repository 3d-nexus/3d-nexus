import { deflateSync } from "fflate";
import { describe, expect, it } from "vitest";
import { FBXBinaryTokenizer } from "../FBXBinaryTokenizer";

function createBinaryFixture(version: number): ArrayBuffer {
  const magic = new TextEncoder().encode("Kaydara FBX Binary  \0\x1a\0");
  const payload = deflateSync(new Uint8Array([1, 2, 3, 4]));
  const bytes: number[] = [...magic];
  const versionBuffer = new ArrayBuffer(4);
  new DataView(versionBuffer).setUint32(0, version, true);
  bytes.push(...new Uint8Array(versionBuffer));
  if (version >= 7500) {
    const offsetBuffer = new ArrayBuffer(8);
    new DataView(offsetBuffer).setBigUint64(0, 123n, true);
    bytes.push(...new Uint8Array(offsetBuffer));
  } else {
    const offsetBuffer = new ArrayBuffer(4);
    new DataView(offsetBuffer).setUint32(0, 123, true);
    bytes.push(...new Uint8Array(offsetBuffer));
  }
  const len = new ArrayBuffer(4);
  new DataView(len).setUint32(0, 4, true);
  bytes.push(...new Uint8Array(len));
  const encoding = new ArrayBuffer(4);
  new DataView(encoding).setUint32(0, 1, true);
  bytes.push(...new Uint8Array(encoding));
  const compressedLength = new ArrayBuffer(4);
  new DataView(compressedLength).setUint32(0, payload.length, true);
  bytes.push(...new Uint8Array(compressedLength));
  bytes.push(...payload);
  return Uint8Array.from(bytes).buffer;
}

describe("FBXBinaryTokenizer", () => {
  it("validates magic and decompresses arrays", () => {
    const tokenizer = new FBXBinaryTokenizer();
    const tokens = tokenizer.tokenize(createBinaryFixture(7400));

    expect(tokens[1]).toMatchObject({
      type: "Data",
      name: "Array",
      value: new Uint8Array([1, 2, 3, 4]),
    });
    expect(() => tokenizer.tokenize(new TextEncoder().encode("bad").buffer)).toThrow(/Invalid FBX binary magic/);
  });

  it("detects 64-bit offsets for 7500+", () => {
    const tokenizer = new FBXBinaryTokenizer();
    const tokens = tokenizer.tokenize(createBinaryFixture(7500));
    expect(tokens[0]).toMatchObject({ type: "NodeBegin", properties: [7500, 123n] });
  });
});

import type { GltfAsset } from "./gltfTypes";

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function padLength(length: number): number {
  return (4 - (length % 4)) % 4;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return output;
}

export function isGlb(buffer: ArrayBuffer): boolean {
  return buffer.byteLength >= 12 && new DataView(buffer).getUint32(0, true) === GLB_MAGIC;
}

export function readGlb(buffer: ArrayBuffer): { json: GltfAsset; bin: ArrayBuffer } {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(4, true) !== GLB_VERSION) {
    throw new Error("Invalid GLB header");
  }

  let offset = 12;
  let json: GltfAsset | null = null;
  let bin = new ArrayBuffer(0);
  while (offset + 8 <= buffer.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    const chunk = buffer.slice(offset, offset + chunkLength);
    offset += chunkLength;

    if (chunkType === CHUNK_JSON) {
      json = JSON.parse(new TextDecoder().decode(chunk).trim()) as GltfAsset;
    } else if (chunkType === CHUNK_BIN) {
      bin = chunk;
    }
  }

  if (!json) {
    throw new Error("Invalid GLB: missing JSON chunk");
  }
  return { json, bin };
}

export function writeGlb(json: GltfAsset, bin: ArrayBuffer): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadding = new Uint8Array(padLength(jsonBytes.byteLength)).fill(0x20);
  const binBytes = new Uint8Array(bin);
  const binPadding = new Uint8Array(padLength(binBytes.byteLength));
  const jsonChunkLength = jsonBytes.byteLength + jsonPadding.byteLength;
  const binChunkLength = binBytes.byteLength + binPadding.byteLength;
  const totalLength = 12 + 8 + jsonChunkLength + (binChunkLength > 0 ? 8 + binChunkLength : 0);
  const header = new ArrayBuffer(12);
  const headerView = new DataView(header);
  headerView.setUint32(0, GLB_MAGIC, true);
  headerView.setUint32(4, GLB_VERSION, true);
  headerView.setUint32(8, totalLength, true);

  const jsonHeader = new ArrayBuffer(8);
  const jsonHeaderView = new DataView(jsonHeader);
  jsonHeaderView.setUint32(0, jsonChunkLength, true);
  jsonHeaderView.setUint32(4, CHUNK_JSON, true);

  const chunks = [new Uint8Array(header), new Uint8Array(jsonHeader), jsonBytes, jsonPadding];
  if (binChunkLength > 0) {
    const binHeader = new ArrayBuffer(8);
    const binHeaderView = new DataView(binHeader);
    binHeaderView.setUint32(0, binChunkLength, true);
    binHeaderView.setUint32(4, CHUNK_BIN, true);
    chunks.push(new Uint8Array(binHeader), binBytes, binPadding);
  }

  const output = concatBytes(chunks);
  const buffer = new ArrayBuffer(output.byteLength);
  new Uint8Array(buffer).set(output);
  return buffer;
}

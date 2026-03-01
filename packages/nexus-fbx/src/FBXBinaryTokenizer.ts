import { inflateSync } from "fflate";
import type { FBXToken } from "./FBXTokenizer";

const FBX_BINARY_MAGIC = "Kaydara FBX Binary  \0\x1a\0";

function readArrayBufferSlice(buffer: ArrayBuffer, start: number, end: number): ArrayBuffer {
  return buffer.slice(start, end);
}

export class FBXBinaryTokenizer {
  tokenize(buffer: ArrayBuffer): FBXToken[] {
    const header = new TextDecoder("ascii").decode(buffer.slice(0, 23));
    if (header !== FBX_BINARY_MAGIC) {
      throw new Error("Invalid FBX binary magic");
    }

    const view = new DataView(buffer);
    const version = view.getUint32(23, true);
    let offset = 27;
    let recordOffset: bigint | number = 0;

    if (version >= 7500) {
      recordOffset = view.getBigUint64(offset, true);
      offset += 8;
    } else {
      recordOffset = view.getUint32(offset, true);
      offset += 4;
    }

    const arrayLength = view.getUint32(offset, true);
    offset += 4;
    const encoding = view.getUint32(offset, true);
    offset += 4;
    const compressedLength = view.getUint32(offset, true);
    offset += 4;
    const payload = new Uint8Array(readArrayBufferSlice(buffer, offset, offset + compressedLength));
    const value = encoding === 1 ? new Uint8Array(inflateSync(payload)) : payload;

    return [
      { type: "NodeBegin", name: "BinaryFBX", properties: [version, recordOffset] },
      { type: "Data", name: "Array", value },
      { type: "NodeEnd" },
    ];
  }
}

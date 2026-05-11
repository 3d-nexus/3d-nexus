import { inflateSync } from "fflate";
import type { FBXToken } from "./FBXTokenizer";

const FBX_BINARY_MAGIC = "Kaydara FBX Binary  \0\x1a\0";
const NULL_RECORD_SIZE_32 = 13;
const NULL_RECORD_SIZE_64 = 25;

const DATA_RECORD_NAMES = new Set([
  "AspectHeight",
  "AspectWidth",
  "C",
  "Content",
  "CoordAxis",
  "CoordAxisSign",
  "DeformAccuracy",
  "DeformPercent",
  "FBXVersion",
  "FrontAxis",
  "FrontAxisSign",
  "FullWeights",
  "Indexes",
  "KeyTime",
  "KeyValueFloat",
  "LinkMode",
  "LocalStart",
  "LocalStop",
  "MappingInformationType",
  "Normals",
  "P",
  "PolygonVertexIndex",
  "ReferenceInformationType",
  "RelativeFilename",
  "ShadingModel",
  "SkinningType",
  "TransformLinkMatrix",
  "TransformMatrix",
  "UnitScaleFactor",
  "UpAxis",
  "UpAxisSign",
  "UV",
  "Vertices",
  "Weights",
]);

function sliceArrayBuffer(buffer: ArrayBuffer, start: number, end: number): ArrayBuffer {
  return buffer.slice(start, end);
}

function isNullRecord(buffer: ArrayBuffer, offset: number, size: number): boolean {
  const bytes = new Uint8Array(buffer, offset, Math.min(size, buffer.byteLength - offset));
  return bytes.length === size && bytes.every((byte) => byte === 0);
}

function readString(buffer: ArrayBuffer, offset: number, length: number): string {
  return new TextDecoder().decode(buffer.slice(offset, offset + length));
}

export class FBXBinaryTokenizer {
  private buffer: ArrayBuffer = new ArrayBuffer(0);
  private view: DataView = new DataView(this.buffer);
  private version = 0;

  tokenize(buffer: ArrayBuffer): FBXToken[] {
    const header = new TextDecoder("ascii").decode(buffer.slice(0, 23));
    if (header !== FBX_BINARY_MAGIC) {
      throw new Error("Invalid FBX binary magic");
    }

    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.version = this.view.getUint32(23, true);

    const tokens: FBXToken[] = [];
    this.readRecords(27, buffer.byteLength, tokens);
    return tokens;
  }

  private get nullRecordSize(): number {
    return this.version >= 7500 ? NULL_RECORD_SIZE_64 : NULL_RECORD_SIZE_32;
  }

  private readRecords(offset: number, endOffset: number, tokens: FBXToken[]): number {
    let currentOffset = offset;
    while (currentOffset < endOffset) {
      if (currentOffset + this.nullRecordSize <= this.buffer.byteLength && isNullRecord(this.buffer, currentOffset, this.nullRecordSize)) {
        return currentOffset + this.nullRecordSize;
      }
      const nextOffset = this.readRecord(currentOffset, tokens);
      if (nextOffset <= currentOffset) {
        break;
      }
      currentOffset = nextOffset;
    }
    return currentOffset;
  }

  private readRecord(offset: number, tokens: FBXToken[]): number {
    const endOffset = this.readRecordEndOffset(offset);
    if (endOffset === 0) {
      return offset + this.nullRecordSize;
    }

    const propertyCountOffset = offset + (this.version >= 7500 ? 8 : 4);
    const propertyListLengthOffset = propertyCountOffset + (this.version >= 7500 ? 8 : 4);
    const nameLengthOffset = propertyListLengthOffset + (this.version >= 7500 ? 8 : 4);
    const propertyCount = this.readRecordCount(propertyCountOffset);
    const nameLength = this.view.getUint8(nameLengthOffset);
    let currentOffset = nameLengthOffset + 1;
    const name = readString(this.buffer, currentOffset, nameLength);
    currentOffset += nameLength;

    const properties: Array<string | number | boolean | bigint | ArrayBuffer | Array<unknown>> = [];
    for (let index = 0; index < propertyCount; index += 1) {
      const property = this.readProperty(currentOffset);
      properties.push(property.value);
      currentOffset = property.nextOffset;
    }

    const hasChildren = currentOffset < endOffset && !isNullRecord(this.buffer, currentOffset, Math.min(this.nullRecordSize, endOffset - currentOffset));
    if (DATA_RECORD_NAMES.has(name) && !hasChildren) {
      tokens.push({
        type: "Data",
        name,
        value: properties.length <= 1 ? (properties[0] ?? "") : properties,
      });
      return endOffset;
    }

    tokens.push({
      type: "NodeBegin",
      name,
      properties: properties.filter(
        (property): property is string | number | boolean | bigint => !(property instanceof ArrayBuffer) && !Array.isArray(property),
      ),
    });
    this.readRecords(currentOffset, endOffset, tokens);
    tokens.push({ type: "NodeEnd" });
    return endOffset;
  }

  private readRecordEndOffset(offset: number): number {
    return this.version >= 7500 ? Number(this.view.getBigUint64(offset, true)) : this.view.getUint32(offset, true);
  }

  private readRecordCount(offset: number): number {
    return this.version >= 7500 ? Number(this.view.getBigUint64(offset, true)) : this.view.getUint32(offset, true);
  }

  private readProperty(offset: number): { value: string | number | boolean | bigint | ArrayBuffer | Array<unknown>; nextOffset: number } {
    const type = String.fromCharCode(this.view.getUint8(offset));
    let currentOffset = offset + 1;

    if (type === "C") {
      return { value: this.view.getUint8(currentOffset) !== 0, nextOffset: currentOffset + 1 };
    }
    if (type === "Y") {
      return { value: this.view.getInt16(currentOffset, true), nextOffset: currentOffset + 2 };
    }
    if (type === "I") {
      return { value: this.view.getInt32(currentOffset, true), nextOffset: currentOffset + 4 };
    }
    if (type === "L") {
      return { value: this.view.getBigInt64(currentOffset, true), nextOffset: currentOffset + 8 };
    }
    if (type === "F") {
      return { value: this.view.getFloat32(currentOffset, true), nextOffset: currentOffset + 4 };
    }
    if (type === "D") {
      return { value: this.view.getFloat64(currentOffset, true), nextOffset: currentOffset + 8 };
    }
    if (type === "S") {
      const length = this.view.getUint32(currentOffset, true);
      currentOffset += 4;
      return {
        value: readString(this.buffer, currentOffset, length),
        nextOffset: currentOffset + length,
      };
    }
    if (type === "R") {
      const length = this.view.getUint32(currentOffset, true);
      currentOffset += 4;
      return {
        value: sliceArrayBuffer(this.buffer, currentOffset, currentOffset + length),
        nextOffset: currentOffset + length,
      };
    }
    if (type === "b" || type === "c" || type === "i" || type === "l" || type === "f" || type === "d") {
      return this.readArrayProperty(type, currentOffset);
    }

    throw new Error(`Unsupported FBX binary property type: ${type}`);
  }

  private readArrayProperty(type: string, offset: number): { value: Array<unknown>; nextOffset: number } {
    const arrayLength = this.view.getUint32(offset, true);
    const encoding = this.view.getUint32(offset + 4, true);
    const compressedLength = this.view.getUint32(offset + 8, true);
    const payloadOffset = offset + 12;
    const payload = new Uint8Array(sliceArrayBuffer(this.buffer, payloadOffset, payloadOffset + compressedLength));
    const bytes = encoding === 1 ? new Uint8Array(inflateSync(payload)) : payload;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const values: Array<unknown> = [];
    const stride = type === "b" || type === "c" ? 1 : type === "i" || type === "f" ? 4 : 8;

    for (let index = 0; index < arrayLength; index += 1) {
      const valueOffset = index * stride;
      if (type === "b" || type === "c") values.push(bytes[valueOffset] !== 0);
      else if (type === "i") values.push(view.getInt32(valueOffset, true));
      else if (type === "l") values.push(view.getBigInt64(valueOffset, true));
      else if (type === "f") values.push(view.getFloat32(valueOffset, true));
      else values.push(view.getFloat64(valueOffset, true));
    }

    return { value: values, nextOffset: payloadOffset + compressedLength };
  }
}

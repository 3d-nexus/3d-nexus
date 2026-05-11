import type { FbxExportNode } from "./FBXExportNode";
import type { FBXToken } from "./FBXTokenizer";

const FBX_BINARY_MAGIC = "Kaydara FBX Binary  \0\x1a\0";
const FBX_BINARY_VERSION = 7400;
const NULL_RECORD_SIZE = 13;

export interface BinaryFbxRecord {
  name: string;
  properties: unknown[];
  children: BinaryFbxRecord[];
}

class ByteWriter {
  private readonly chunks: number[] = [];

  get offset(): number {
    return this.chunks.length;
  }

  writeUint8(value: number): void {
    this.chunks.push(value & 0xff);
  }

  writeInt16(value: number): void {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, value, true);
    this.writeBytes(new Uint8Array(buffer));
  }

  writeInt32(value: number): void {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setInt32(0, value, true);
    this.writeBytes(new Uint8Array(buffer));
  }

  writeUint32(value: number): void {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint32(0, value, true);
    this.writeBytes(new Uint8Array(buffer));
  }

  writeInt64(value: bigint): void {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigInt64(0, value, true);
    this.writeBytes(new Uint8Array(buffer));
  }

  writeFloat32(value: number): void {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, value, true);
    this.writeBytes(new Uint8Array(buffer));
  }

  writeFloat64(value: number): void {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, value, true);
    this.writeBytes(new Uint8Array(buffer));
  }

  writeTextBytes(value: string): void {
    this.writeBytes(new TextEncoder().encode(value));
  }

  writeBytes(bytes: Uint8Array): void {
    bytes.forEach((byte) => this.writeUint8(byte));
  }

  patchUint32(offset: number, value: number): void {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint32(0, value, true);
    Array.from(new Uint8Array(buffer)).forEach((byte, index) => {
      this.chunks[offset + index] = byte;
    });
  }

  toArrayBuffer(): ArrayBuffer {
    return Uint8Array.from(this.chunks).buffer;
  }
}

function tokenValueToProperties(value: FBXToken & { type: "Data" }): unknown[] {
  return Array.isArray(value.value) ? value.value : [value.value];
}

function buildRecords(tokens: FBXToken[]): BinaryFbxRecord[] {
  const root: BinaryFbxRecord = { name: "__root__", properties: [], children: [] };
  const stack = [root];

  tokens.forEach((token) => {
    const current = stack[stack.length - 1]!;
    if (token.type === "NodeBegin") {
      const record: BinaryFbxRecord = { name: token.name, properties: token.properties, children: [] };
      current.children.push(record);
      stack.push(record);
      return;
    }
    if (token.type === "NodeEnd") {
      stack.pop();
      return;
    }
    current.children.push({ name: token.name, properties: tokenValueToProperties(token), children: [] });
  });

  return root.children;
}

function splitArguments(text: string): Array<string | number | boolean> {
  const values: Array<string | number | boolean> = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      quoted = !quoted;
      current += char;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(parseArgument(current));
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim().length > 0) {
    values.push(parseArgument(current));
  }

  return values;
}

function parseArgument(text: string): string | number | boolean {
  const value = text.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
  }
  if (value === "Y" || value === "true") return true;
  if (value === "N" || value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d+\.\d+(?:e[+-]?\d+)?$/i.test(value)) return Number(value);
  return value;
}

function parseLineRecord(line: string): BinaryFbxRecord | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed === "}") {
    return null;
  }

  const scoped = trimmed.endsWith("{");
  const content = scoped ? trimmed.slice(0, -1).trim() : trimmed;
  const separator = content.indexOf(":");
  if (separator < 0) {
    return null;
  }

  const name = content.slice(0, separator).trim();
  const rawProperties = content.slice(separator + 1).trim();
  return {
    name,
    properties: rawProperties ? splitArguments(rawProperties) : [],
    children: [],
  };
}

function appendLineRecords(parent: BinaryFbxRecord, lines: string[]): void {
  const stack = [parent];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    if (trimmed === "}") {
      stack.pop();
      return;
    }

    const record = parseLineRecord(trimmed);
    if (!record) {
      return;
    }

    stack[stack.length - 1]!.children.push(record);
    if (trimmed.endsWith("{")) {
      stack.push(record);
    }
  });
}

function buildRecordFromExportNode(node: FbxExportNode): BinaryFbxRecord {
  const record: BinaryFbxRecord = {
    name: node.name,
    properties: node.properties,
    children: [],
  };
  appendLineRecords(record, node.lines);
  record.children.push(...node.children.map(buildRecordFromExportNode));
  return record;
}

function normalizeProperty(value: unknown): string | number | boolean | bigint | Uint8Array {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value;
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  return String(value ?? "");
}

function writeProperty(writer: ByteWriter, value: unknown): void {
  const property = normalizeProperty(value);

  if (typeof property === "boolean") {
    writer.writeTextBytes("C");
    writer.writeUint8(property ? 1 : 0);
    return;
  }
  if (typeof property === "bigint") {
    writer.writeTextBytes("L");
    writer.writeInt64(property);
    return;
  }
  if (typeof property === "number") {
    if (Number.isInteger(property)) {
      if (property >= -2147483648 && property <= 2147483647) {
        writer.writeTextBytes("I");
        writer.writeInt32(property);
      } else {
        writer.writeTextBytes("L");
        writer.writeInt64(BigInt(property));
      }
      return;
    }
    writer.writeTextBytes("D");
    writer.writeFloat64(property);
    return;
  }
  if (property instanceof Uint8Array) {
    writer.writeTextBytes("R");
    writer.writeUint32(property.byteLength);
    writer.writeBytes(property);
    return;
  }

  const bytes = new TextEncoder().encode(property);
  writer.writeTextBytes("S");
  writer.writeUint32(bytes.byteLength);
  writer.writeBytes(bytes);
}

function writeNullRecord(writer: ByteWriter): void {
  for (let index = 0; index < NULL_RECORD_SIZE; index += 1) {
    writer.writeUint8(0);
  }
}

function writeRecord(writer: ByteWriter, record: BinaryFbxRecord): void {
  const startOffset = writer.offset;
  writer.writeUint32(0);
  writer.writeUint32(record.properties.length);
  writer.writeUint32(0);

  const name = new TextEncoder().encode(record.name);
  writer.writeUint8(name.byteLength);
  writer.writeBytes(name);

  const propertyStartOffset = writer.offset;
  record.properties.forEach((property) => writeProperty(writer, property));
  const propertyListLength = writer.offset - propertyStartOffset;

  record.children.forEach((child) => writeRecord(writer, child));
  if (record.children.length > 0) {
    writeNullRecord(writer);
  }

  writer.patchUint32(startOffset, writer.offset);
  writer.patchUint32(startOffset + 8, propertyListLength);
}

export class FBXBinaryWriter {
  write(tokens: FBXToken[]): ArrayBuffer {
    return this.writeRecords(buildRecords(tokens));
  }

  writeNodes(nodes: FbxExportNode[]): ArrayBuffer {
    return this.writeRecords(nodes.map(buildRecordFromExportNode));
  }

  writeRecords(records: BinaryFbxRecord[]): ArrayBuffer {
    const writer = new ByteWriter();
    writer.writeTextBytes(FBX_BINARY_MAGIC);
    writer.writeUint32(FBX_BINARY_VERSION);
    records.forEach((record) => writeRecord(writer, record));
    writeNullRecord(writer);
    return writer.toArrayBuffer();
  }
}

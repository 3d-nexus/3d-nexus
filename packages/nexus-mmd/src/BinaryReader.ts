export class BinaryReader {
  private readonly view: DataView;
  private offset = 0;

  constructor(private readonly buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  get position(): number {
    return this.offset;
  }

  set position(value: number) {
    this.offset = value;
  }

  readUint8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16(): number {
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readUint32(): number {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readInt8(): number {
    const value = this.view.getInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readInt16(): number {
    const value = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readInt32(): number {
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat32(): number {
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat64(): number {
    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.buffer, this.offset, length);
    this.offset += length;
    return new Uint8Array(bytes);
  }

  readString(length: number, encoding: string): string {
    return new TextDecoder(encoding).decode(this.readBytes(length));
  }

  readTextBuffer(encoding: string): string {
    const length = this.readInt32();
    return this.readString(length, encoding);
  }

  readIndex(size: number, signed = true): number {
    switch (size) {
      case 1:
        return signed ? this.readInt8() : this.readUint8();
      case 2:
        return signed ? this.readInt16() : this.readUint16();
      case 4:
        return signed ? this.readInt32() : this.readUint32();
      default:
        throw new Error(`Unsupported index size: ${size}`);
    }
  }
}

export class BinaryWriter {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset = 0;

  constructor(initialCapacity = 1024) {
    this.buffer = new ArrayBuffer(initialCapacity);
    this.view = new DataView(this.buffer);
  }

  private ensureCapacity(size: number): void {
    if (this.offset + size <= this.buffer.byteLength) {
      return;
    }

    let nextCapacity = this.buffer.byteLength;
    while (this.offset + size > nextCapacity) {
      nextCapacity *= 2;
    }

    const nextBuffer = new ArrayBuffer(nextCapacity);
    new Uint8Array(nextBuffer).set(new Uint8Array(this.buffer, 0, this.offset));
    this.buffer = nextBuffer;
    this.view = new DataView(this.buffer);
  }

  writeUint8(value: number): void {
    this.ensureCapacity(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  writeUint16(value: number): void {
    this.ensureCapacity(2);
    this.view.setUint16(this.offset, value, true);
    this.offset += 2;
  }

  writeUint32(value: number): void {
    this.ensureCapacity(4);
    this.view.setUint32(this.offset, value, true);
    this.offset += 4;
  }

  writeInt8(value: number): void {
    this.ensureCapacity(1);
    this.view.setInt8(this.offset, value);
    this.offset += 1;
  }

  writeInt16(value: number): void {
    this.ensureCapacity(2);
    this.view.setInt16(this.offset, value, true);
    this.offset += 2;
  }

  writeInt32(value: number): void {
    this.ensureCapacity(4);
    this.view.setInt32(this.offset, value, true);
    this.offset += 4;
  }

  writeFloat32(value: number): void {
    this.ensureCapacity(4);
    this.view.setFloat32(this.offset, value, true);
    this.offset += 4;
  }

  writeFloat64(value: number): void {
    this.ensureCapacity(8);
    this.view.setFloat64(this.offset, value, true);
    this.offset += 8;
  }

  writeBytes(src: Uint8Array): void {
    this.ensureCapacity(src.byteLength);
    new Uint8Array(this.buffer, this.offset, src.byteLength).set(src);
    this.offset += src.byteLength;
  }

  writeString(value: string, encoding: string, fixedLen?: number): void {
    const encoded = new TextEncoder().encode(value);
    const bytes =
      fixedLen === undefined
        ? encoded
        : (() => {
            const out = new Uint8Array(fixedLen);
            out.set(encoded.subarray(0, fixedLen));
            return out;
          })();

    if (fixedLen === undefined) {
      this.writeInt32(bytes.byteLength);
    }
    this.writeBytes(bytes);
  }

  toArrayBuffer(): ArrayBuffer {
    return this.buffer.slice(0, this.offset);
  }
}

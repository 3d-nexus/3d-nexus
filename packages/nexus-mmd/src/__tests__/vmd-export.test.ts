import { describe, expect, it } from "vitest";
import { BinaryWriter } from "../BinaryWriter";
import { MMDImporter } from "../MMDImporter";
import { MMDVmdExporter } from "../MMDVmdExporter";
import { MMDVmdParser } from "../MMDVmdParser";

const HEADER = "Vocaloid Motion Data 0002";
const INTERPOLATION_OFFSET = 30 + 20 + 4 + 15 + 4 + 12 + 16;

function writeFixedString(writer: BinaryWriter, text: string, length: number): void {
  writer.writeString(text, "shift-jis", length);
}

function createVmdBuffer(options?: { interpolation?: Uint8Array; cameraCount?: number; lightCount?: number; morphCount?: number; ikCount?: number }): ArrayBuffer {
  const writer = new BinaryWriter();
  const interpolation =
    options?.interpolation ??
    (() => {
      const bytes = new Uint8Array(64);
      [7, 19, 31, 43].forEach((value, index) => {
        bytes[index * 16] = value;
        bytes[index * 16 + 4] = value + 1;
        bytes[index * 16 + 8] = value + 2;
        bytes[index * 16 + 12] = value + 3;
      });
      return bytes;
    })();

  writeFixedString(writer, HEADER, 30);
  writeFixedString(writer, "Model", 20);

  writer.writeUint32(1);
  writeFixedString(writer, "VMDRoot", 15);
  writer.writeUint32(12);
  writer.writeFloat32(1);
  writer.writeFloat32(2);
  writer.writeFloat32(3);
  writer.writeFloat32(0);
  writer.writeFloat32(0);
  writer.writeFloat32(0);
  writer.writeFloat32(1);
  writer.writeBytes(interpolation);

  const morphCount = options?.morphCount ?? 0;
  writer.writeUint32(morphCount);
  for (let index = 0; index < morphCount; index += 1) {
    writeFixedString(writer, `Morph${index}`, 15);
    writer.writeUint32(index * 7);
    writer.writeFloat32(0.25 + index);
  }

  const cameraCount = options?.cameraCount ?? 0;
  writer.writeUint32(cameraCount);
  for (let index = 0; index < cameraCount; index += 1) {
    writer.writeUint32(index * 10);
    writer.writeFloat32(30 - index);
    writer.writeFloat32(index);
    writer.writeFloat32(index + 1);
    writer.writeFloat32(index + 2);
    writer.writeFloat32(0.1 * index);
    writer.writeFloat32(0.2 * index);
    writer.writeFloat32(0.3 * index);
    writer.writeBytes(Uint8Array.from({ length: 24 }, (_, byteIndex) => (byteIndex + index) % 128));
    writer.writeUint32(45 + index);
    writer.writeUint8(index % 2);
  }

  const lightCount = options?.lightCount ?? 0;
  writer.writeUint32(lightCount);
  for (let index = 0; index < lightCount; index += 1) {
    writer.writeUint32(index * 5);
    writer.writeFloat32(0.1 + index);
    writer.writeFloat32(0.2 + index);
    writer.writeFloat32(0.3 + index);
    writer.writeFloat32(1 + index);
    writer.writeFloat32(2 + index);
    writer.writeFloat32(3 + index);
  }
  writer.writeUint32(0);

  const ikCount = options?.ikCount ?? 0;
  writer.writeUint32(ikCount);
  for (let index = 0; index < ikCount; index += 1) {
    writer.writeUint32(index * 3);
    writer.writeUint8(1);
    writer.writeUint32(1);
    writeFixedString(writer, `IK${index}`, 20);
    writer.writeUint8(index % 2);
  }

  return writer.toArrayBuffer();
}

describe("VMD export", () => {
  it("preserves bone interpolation bytes across import/export", () => {
    const input = createVmdBuffer();
    const importer = new MMDImporter();
    const exporter = new MMDVmdExporter();

    const scene = importer.read(input, "interp.vmd").scene;
    const exported = exporter.write(scene);

    expect(Array.from(new Uint8Array(exported).slice(INTERPOLATION_OFFSET, INTERPOLATION_OFFSET + 64))).toEqual(
      Array.from(new Uint8Array(input).slice(INTERPOLATION_OFFSET, INTERPOLATION_OFFSET + 64)),
    );
  });

  it("roundtrips morph, camera, light, and IK frame counts", () => {
    const input = createVmdBuffer({ cameraCount: 3, lightCount: 2, morphCount: 2, ikCount: 2 });
    const importer = new MMDImporter();
    const exporter = new MMDVmdExporter();
    const parser = new MMDVmdParser();

    const scene = importer.read(input, "camera.vmd").scene;
    const exported = exporter.write(scene);
    const reparsed = parser.parse(exported);

    expect(reparsed.morphFrames).toHaveLength(2);
    expect(reparsed.cameraFrames).toHaveLength(3);
    expect(reparsed.lightFrames).toHaveLength(2);
    expect(reparsed.ikFrames).toHaveLength(2);
    expect(reparsed.morphFrames[1]?.frame).toBe(7);
    expect(reparsed.lightFrames[1]?.position?.[2]).toBe(4);
  });
});

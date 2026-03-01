import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TriangulateStep } from "../postprocess/TriangulateStep";
import { ModelConverter } from "../ModelConverter";

function readFixture(name: string): ArrayBuffer {
  const file = readFileSync(join(import.meta.dirname, "../../../nexus-obj/src/__tests__/fixtures", name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

describe("ModelConverter", () => {
  it("supports OBJ to OBJ and OBJ to FBX conversion", () => {
    const converter = new ModelConverter();
    const obj = readFixture("cube.obj");

    const objRoundtrip = new TextDecoder().decode(converter.convert(obj, "obj", "obj"));
    const fbx = converter.convert(obj, "obj", "fbx");

    expect(objRoundtrip).toContain("v ");
    expect(fbx.byteLength).toBeGreaterThan(0);
  });

  it("triangulates quads during conversion", () => {
    const converter = new ModelConverter();
    const obj = readFixture("cube.obj");
    const triangulated = new TextDecoder().decode(
      converter.convert(obj, "obj", "obj", { postProcess: [new TriangulateStep()] }),
    );

    expect(triangulated.match(/^f /gm)?.length).toBeGreaterThan(2);
  });
});

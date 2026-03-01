import { describe, expect, it } from "vitest";
import { ObjFileMtlParser } from "../ObjFileMtlParser";

describe("ObjFileMtlParser", () => {
  it("parses diffuse color, texture and alpha", () => {
    const parser = new ObjFileMtlParser();
    const [material] = parser.parse(`
newmtl Test
Kd 0.8 0.6 0.4
map_Kd textures/albedo.png
d 0.5
`);

    expect(material).toMatchObject({
      name: "Test",
      diffuse: { r: 0.8, g: 0.6, b: 0.4 },
      textureDiffuse: "textures/albedo.png",
      dissolve: 0.5,
    });
  });
});

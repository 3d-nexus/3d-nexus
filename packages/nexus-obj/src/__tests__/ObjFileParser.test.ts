import { describe, expect, it } from "vitest";
import { ObjFileParser } from "../ObjFileParser";

describe("ObjFileParser", () => {
  it("parses vertices, faces, negative indices and skips comments", () => {
    const parser = new ObjFileParser();
    const model = parser.parse(`
# comment
o Mesh
v 0 0 0
v 1 0 0
v 1 1 0
vt 0 0
vt 1 0
vt 1 1
vn 0 0 1
f 1/1/1 2/2/1 3/3/1
f -1 -2 -3
f 1//1 2//1 3//1
`);

    expect(model.vertices).toHaveLength(3);
    expect(model.objects[1]?.groups[0]?.faces).toHaveLength(3);
    expect(model.objects[1]?.groups[0]?.faces[1]?.vertices[0]).toMatchObject({
      vertexIndex: 2,
      textureIndex: -1,
      normalIndex: -1,
    });
    expect(model.objects[1]?.groups[0]?.faces[2]?.vertices[0]).toMatchObject({
      vertexIndex: 0,
      textureIndex: -1,
      normalIndex: 0,
    });
  });
});

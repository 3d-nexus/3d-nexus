import { normalizeVector3, type AiScene } from "@3d-nexus/core";
import type { PostProcessStep } from "./PostProcessStep";

function cross(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export class GenerateNormalsStep implements PostProcessStep {
  process(scene: AiScene): AiScene {
    return {
      ...scene,
      meshes: scene.meshes.map((mesh) => {
        if (mesh.normals.length > 0) {
          return mesh;
        }

        const normals = Array.from({ length: mesh.vertices.length }, () => ({ x: 0, y: 0, z: 1 }));
        mesh.faces.forEach((face) => {
          if (face.indices.length < 3) return;
          const a = mesh.vertices[face.indices[0]!];
          const b = mesh.vertices[face.indices[1]!];
          const c = mesh.vertices[face.indices[2]!];
          if (!a || !b || !c) return;
          const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
          const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
          const normal = normalizeVector3(cross(ab, ac));
          face.indices.forEach((index) => {
            normals[index] = normal;
          });
        });
        return { ...mesh, normals };
      }),
    };
  }
}


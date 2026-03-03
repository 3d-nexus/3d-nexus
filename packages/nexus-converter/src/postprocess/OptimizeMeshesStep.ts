import { type AiScene } from "@3d-nexus/core";
import type { PostProcessStep } from "./PostProcessStep";

export class OptimizeMeshesStep implements PostProcessStep {
  process(scene: AiScene): AiScene {
    const grouped = new Map<number, typeof scene.meshes>();
    scene.meshes.forEach((mesh) => {
      const meshes = grouped.get(mesh.materialIndex) ?? [];
      meshes.push(mesh);
      grouped.set(mesh.materialIndex, meshes);
    });

    return {
      ...scene,
      meshes: [...grouped.entries()].map(([materialIndex, meshes]) => {
        const first = meshes[0]!;
        let vertexOffset = 0;
        return {
          ...first,
          name: meshes.map((mesh) => mesh.name).join("+"),
          materialIndex,
          vertices: meshes.flatMap((mesh) => mesh.vertices),
          normals: meshes.flatMap((mesh) => mesh.normals),
          tangents: [],
          bitangents: [],
          faces: meshes.flatMap((mesh) => {
            const translated = mesh.faces.map((face) => ({
              indices: face.indices.map((index) => index + vertexOffset),
            }));
            vertexOffset += mesh.vertices.length;
            return translated;
          }),
        };
      }),
    };
  }
}


import {
  AiPropertyTypeInfo,
  AiTextureType,
  type AiMaterial,
  type AiMesh,
  type AiScene,
  type BaseExporter,
  type ExportSettings,
} from "nexus-core";

function getMaterialProperty(material: AiMaterial, key: string, semantic: AiTextureType): unknown {
  return material.properties.find((property) => property.key === key && property.semantic === semantic)?.data;
}

export class ObjExporter implements BaseExporter {
  private mtlContent = "";

  getSupportedExtensions(): string[] {
    return ["obj"];
  }

  getMtlContent(): string {
    return this.mtlContent;
  }

  write(scene: AiScene, settings?: ExportSettings): ArrayBuffer {
    const objLines: string[] = ["# Exported by nexus-obj"];
    const mtlFileName = settings?.mtlFileName ?? "scene.mtl";

    if (scene.materials.length > 0) {
      objLines.push(`mtllib ${mtlFileName}`);
    }

    const mtlLines: string[] = [];
    let vertexOffset = 1;
    let uvOffset = 1;
    let normalOffset = 1;

    scene.materials.forEach((material) => {
      mtlLines.push(`newmtl ${material.name}`);
      const diffuse = getMaterialProperty(material, "$clr.diffuse", AiTextureType.DIFFUSE) as
        | { r: number; g: number; b: number; a?: number }
        | undefined;
      if (diffuse) {
        mtlLines.push(`Kd ${diffuse.r} ${diffuse.g} ${diffuse.b}`);
        if (typeof diffuse.a === "number") {
          mtlLines.push(`d ${diffuse.a}`);
        }
      }

      const texture = getMaterialProperty(material, "$tex.file", AiTextureType.DIFFUSE);
      if (typeof texture === "string") {
        mtlLines.push(`map_Kd ${texture}`);
      }
      mtlLines.push("");
    });

    scene.meshes.forEach((mesh, meshIndex) => {
      objLines.push(`o ${mesh.name || `mesh_${meshIndex}`}`);
      const material = scene.materials[mesh.materialIndex];
      if (material) {
        objLines.push(`usemtl ${material.name}`);
      }

      mesh.vertices.forEach((vertex) => {
        objLines.push(`v ${vertex.x} ${vertex.y} ${vertex.z}`);
      });

      const uvChannel = mesh.textureCoords[0];
      uvChannel?.forEach((uv) => {
        objLines.push(`vt ${uv.x} ${uv.y}`);
      });

      mesh.normals.forEach((normal) => {
        objLines.push(`vn ${normal.x} ${normal.y} ${normal.z}`);
      });

      mesh.faces.forEach((face) => {
        const tokens = face.indices.map((faceIndex) =>
          this.formatFaceVertex(mesh, faceIndex, vertexOffset, uvOffset, normalOffset),
        );
        objLines.push(`f ${tokens.join(" ")}`);
      });

      vertexOffset += mesh.vertices.length;
      if (uvChannel) {
        uvOffset += uvChannel.length;
      }
      normalOffset += mesh.normals.length;
    });

    this.mtlContent = mtlLines.join("\n").trim();
    return new TextEncoder().encode(objLines.join("\n")).buffer;
  }

  private formatFaceVertex(
    mesh: AiMesh,
    faceIndex: number,
    vertexOffset: number,
    uvOffset: number,
    normalOffset: number,
  ): string {
    const vertexIndex = vertexOffset + faceIndex;
    const hasUvs = Boolean(mesh.textureCoords[0]?.[faceIndex]);
    const hasNormals = Boolean(mesh.normals[faceIndex]);

    if (hasUvs && hasNormals) {
      return `${vertexIndex}/${uvOffset + faceIndex}/${normalOffset + faceIndex}`;
    }

    if (hasUvs) {
      return `${vertexIndex}/${uvOffset + faceIndex}`;
    }

    if (hasNormals) {
      return `${vertexIndex}//${normalOffset + faceIndex}`;
    }

    return `${vertexIndex}`;
  }
}

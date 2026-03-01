import type { AiVector2D, AiVector3D } from "nexus-core";
import type { ObjFace, ObjFaceVertex, ObjGroup, ObjModel, ObjObject } from "./ObjFileData";

function createObject(name: string): ObjObject {
  return { name, groups: [] };
}

function createGroup(name: string, materialName: string | null): ObjGroup {
  return { name, materialName, faces: [] };
}

function parseVector3(parts: string[]): AiVector3D {
  return {
    x: Number(parts[0] ?? 0),
    y: Number(parts[1] ?? 0),
    z: Number(parts[2] ?? 0),
  };
}

function parseVector2(parts: string[]): AiVector2D {
  return {
    x: Number(parts[0] ?? 0),
    y: Number(parts[1] ?? 0),
  };
}

function resolveIndex(value: string | undefined, total: number): number {
  if (!value) {
    return -1;
  }

  const parsed = Number(value);
  if (parsed > 0) {
    return parsed - 1;
  }

  if (parsed < 0) {
    return total + parsed;
  }

  return -1;
}

function parseFaceVertex(token: string, model: ObjModel): ObjFaceVertex {
  const [v, vt, vn] = token.split("/");
  return {
    vertexIndex: resolveIndex(v, model.vertices.length),
    textureIndex: resolveIndex(vt, model.textureCoords.length),
    normalIndex: resolveIndex(vn, model.normals.length),
  };
}

export class ObjFileParser {
  parse(text: string): ObjModel {
    const model: ObjModel = {
      vertices: [],
      normals: [],
      textureCoords: [],
      objects: [],
      materialLibraries: [],
      materials: [],
    };

    let currentObject = createObject("default");
    model.objects.push(currentObject);
    let currentMaterial: string | null = null;
    let currentSmoothingGroup: string | null = null;
    let currentGroup = createGroup("default", currentMaterial);
    currentObject.groups.push(currentGroup);

    const ensureGroup = (name: string, materialName: string | null): ObjGroup => {
      const existing = currentObject.groups.find(
        (group) => group.name === name && group.materialName === materialName,
      );
      if (existing) {
        return existing;
      }

      const group = createGroup(name, materialName);
      currentObject.groups.push(group);
      return group;
    };

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const [directive, ...parts] = line.split(/\s+/);
      if (!directive) {
        continue;
      }

      switch (directive) {
        case "v":
          model.vertices.push(parseVector3(parts));
          break;
        case "vn":
          model.normals.push(parseVector3(parts));
          break;
        case "vt":
          model.textureCoords.push(parseVector2(parts));
          break;
        case "o":
          currentObject = createObject(parts.join(" ") || `object_${model.objects.length}`);
          model.objects.push(currentObject);
          currentGroup = createGroup("default", currentMaterial);
          currentObject.groups.push(currentGroup);
          break;
        case "g":
          currentGroup = ensureGroup(parts.join(" ") || "default", currentMaterial);
          break;
        case "usemtl":
          currentMaterial = parts.join(" ") || null;
          currentGroup = ensureGroup(currentGroup.name, currentMaterial);
          break;
        case "mtllib":
          model.materialLibraries.push(parts.join(" "));
          break;
        case "s":
          currentSmoothingGroup = parts.join(" ") || null;
          break;
        case "f": {
          const face: ObjFace = {
            vertices: parts.map((part) => parseFaceVertex(part, model)),
            materialName: currentMaterial,
            objectName: currentObject.name,
            groupName: currentGroup.name,
            smoothingGroup: currentSmoothingGroup,
          };
          currentGroup.faces.push(face);
          break;
        }
        default:
          break;
      }
    }

    return model;
  }
}

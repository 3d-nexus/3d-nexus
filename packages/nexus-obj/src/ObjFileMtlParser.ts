import type { AiColor3D } from "@3d-nexus/core";
import type { ObjMaterial } from "./ObjFileData";

const COLOR_DIRECTIVES = new Set(["Ka", "Kd", "Ks", "Ke"]);

function parseColor(parts: string[]): AiColor3D {
  return {
    r: Number(parts[0] ?? 0),
    g: Number(parts[1] ?? 0),
    b: Number(parts[2] ?? 0),
  };
}

export class ObjFileMtlParser {
  parse(text: string): ObjMaterial[] {
    const materials: ObjMaterial[] = [];
    let current: ObjMaterial | null = null;

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const [directive, ...parts] = line.split(/\s+/);
      if (!directive) {
        continue;
      }

      if (directive === "newmtl") {
        current = { name: parts.join(" ") };
        materials.push(current);
        continue;
      }

      if (!current) {
        continue;
      }

      if (COLOR_DIRECTIVES.has(directive)) {
        const color = parseColor(parts);
        if (directive === "Ka") current.ambient = color;
        if (directive === "Kd") current.diffuse = color;
        if (directive === "Ks") current.specular = color;
        if (directive === "Ke") current.emissive = color;
        continue;
      }

      switch (directive) {
        case "Ns":
          current.shininess = Number(parts[0] ?? 0);
          break;
        case "Ni":
          current.opticalDensity = Number(parts[0] ?? 1);
          break;
        case "d":
          current.dissolve = Number(parts[0] ?? 1);
          break;
        case "Tr":
          current.dissolve = 1 - Number(parts[0] ?? 0);
          break;
        case "illum":
          current.illuminationModel = Number(parts[0] ?? 0);
          break;
        case "map_Ka":
          current.textureAmbient = parts.join(" ");
          break;
        case "map_Kd":
          current.textureDiffuse = parts.join(" ");
          break;
        case "map_Ks":
          current.textureSpecular = parts.join(" ");
          break;
        case "map_Ns":
          current.textureShininess = parts.join(" ");
          break;
        case "map_bump":
        case "bump":
          current.textureBump = parts.join(" ");
          break;
        case "map_d":
          current.textureAlpha = parts.join(" ");
          break;
        case "disp":
          current.displacement = parts.join(" ");
          break;
        default:
          break;
      }
    }

    return materials;
  }
}


import type { AiColor4D, AiVector3D } from "nexus-core";
import type { FBXElement } from "./FBXParser";

export interface PropertyEntry {
  name: string;
  type: string;
  values: Array<string | number | boolean>;
}

export class PropertyTable {
  private readonly values = new Map<string, string | number | boolean | AiVector3D | AiColor4D>();
  readonly entries: PropertyEntry[] = [];

  constructor(element?: FBXElement) {
    const entries = element?.values.P ?? [];
    entries.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length < 5) {
        return;
      }

      const [name, type] = entry;
      const valueParts = entry.slice(4);
      this.entries.push({
        name: String(name),
        type: String(type),
        values: valueParts as Array<string | number | boolean>,
      });
      if (type === "Color" || type === "ColorRGB") {
        this.values.set(String(name), {
          r: Number(valueParts[0] ?? 0),
          g: Number(valueParts[1] ?? 0),
          b: Number(valueParts[2] ?? 0),
          a: 1,
        });
      } else if (type === "Lcl Translation" || type === "Lcl Rotation" || type === "Lcl Scaling" || type === "Vector3D") {
        this.values.set(String(name), {
          x: Number(valueParts[0] ?? 0),
          y: Number(valueParts[1] ?? 0),
          z: Number(valueParts[2] ?? 0),
        });
      } else {
        this.values.set(String(name), valueParts[0] as string | number | boolean);
      }
    });
  }

  get(name: string): string | number | boolean | AiVector3D | AiColor4D | undefined {
    return this.values.get(name);
  }
}

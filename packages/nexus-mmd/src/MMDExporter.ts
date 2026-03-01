import type { AiScene, BaseExporter, ExportSettings } from "nexus-core";
import { MMDPmxExporter } from "./MMDPmxExporter";
import { MMDVmdExporter } from "./MMDVmdExporter";

export class MMDExporter implements BaseExporter {
  private readonly pmxExporter = new MMDPmxExporter();
  private readonly vmdExporter = new MMDVmdExporter();

  getSupportedExtensions(): string[] {
    return ["pmx", "vmd"];
  }

  write(scene: AiScene, settings?: ExportSettings): ArrayBuffer {
    return settings?.format === "vmd" ? this.vmdExporter.write(scene) : this.pmxExporter.write(scene);
  }
}

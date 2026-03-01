import type { ImportResult } from "nexus-core";
import { EXPORTER_REGISTRY, IMPORTER_REGISTRY, type ModelFormat } from "./formats";
import type { ConvertOptions } from "./ConvertOptions";

export class ConversionError extends Error {}

export class ModelConverter {
  convert(input: ArrayBuffer, fromFormat: ModelFormat, toFormat: ModelFormat, options?: ConvertOptions): ArrayBuffer {
    const importer = IMPORTER_REGISTRY[fromFormat];
    const exporter = EXPORTER_REGISTRY[toFormat];
    if (!importer) {
      throw new ConversionError(`Unsupported import format: ${fromFormat}`);
    }
    if (!exporter) {
      throw new ConversionError(`Unsupported export format: ${toFormat}`);
    }

    const result: ImportResult = importer.read(input, `input.${fromFormat}`, options?.importSettings);
    const scene = (options?.postProcess ?? []).reduce((current, step) => step.process(current), result.scene);
    return exporter.write(scene, { ...options?.exportSettings, format: toFormat });
  }
}

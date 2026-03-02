import type { ImportResult } from "nexus-core";
import { EXPORTER_REGISTRY, IMPORTER_REGISTRY, type ModelFormat } from "./formats";
import type { ConvertOptions } from "./ConvertOptions";
import { createSceneCompatibilityReport } from "./compatibility/report";

export class ConversionError extends Error {}

export interface ConversionResult {
  output: ArrayBuffer;
  report?: ReturnType<typeof createSceneCompatibilityReport>;
  warnings: ImportResult["warnings"];
}

export class ModelConverter {
  convert(input: ArrayBuffer, fromFormat: ModelFormat, toFormat: ModelFormat, options?: ConvertOptions): ArrayBuffer {
    return this.convertWithReport(input, fromFormat, toFormat, options).output;
  }

  convertWithReport(input: ArrayBuffer, fromFormat: ModelFormat, toFormat: ModelFormat, options?: ConvertOptions): ConversionResult {
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
    const report = options?.compatibilityProfile
      ? createSceneCompatibilityReport({
          scene,
          profile: options.compatibilityProfile,
          sourceFormat: fromFormat,
          targetFormat: toFormat,
        })
      : undefined;
    return {
      output: exporter.write(scene, { ...options?.exportSettings, format: toFormat }),
      warnings: result.warnings,
      ...(report ? { report } : {}),
    };
  }
}

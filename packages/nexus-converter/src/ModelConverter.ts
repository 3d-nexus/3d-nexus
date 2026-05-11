import type { ExportSettings, ImportResult } from "@3d-nexus/core";
import { EXPORTER_REGISTRY, IMPORTER_REGISTRY, type ModelFormat } from "./formats";
import type { ConvertOptions } from "./ConvertOptions";
import { createSceneCompatibilityReport } from "./compatibility/report";

export class ConversionError extends Error {}

export interface ConversionSidecar {
  fileName: string;
  content: ArrayBuffer;
}

export interface ConversionResult {
  output: ArrayBuffer;
  sidecars?: ConversionSidecar[];
  report?: ReturnType<typeof createSceneCompatibilityReport>;
  warnings: ImportResult["warnings"];
}

function hasBinContent(exporter: unknown): exporter is { getBinContent(): ArrayBuffer } {
  return typeof exporter === "object" && exporter !== null && "getBinContent" in exporter && typeof exporter.getBinContent === "function";
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
    const exportSettings: ExportSettings = { ...options?.exportSettings, format: toFormat };
    const output = exporter.write(scene, exportSettings);
    const sidecars =
      toFormat === "gltf" && hasBinContent(exporter)
        ? [
            {
              fileName: typeof exportSettings.binFileName === "string" ? exportSettings.binFileName : "scene.bin",
              content: exporter.getBinContent(),
            },
          ]
        : undefined;
    return {
      output,
      ...(sidecars ? { sidecars } : {}),
      warnings: result.warnings,
      ...(report ? { report } : {}),
    };
  }
}

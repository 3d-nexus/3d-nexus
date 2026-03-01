import type { ExportSettings, ImportSettings } from "nexus-core";
import type { PostProcessStep } from "./postprocess/PostProcessStep";

export interface ConvertOptions {
  postProcess?: PostProcessStep[];
  importSettings?: ImportSettings;
  exportSettings?: ExportSettings;
}

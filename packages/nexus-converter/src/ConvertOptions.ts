import type { CompatibilityProfileName, ExportSettings, ImportSettings } from "nexus-core";
import type { PostProcessStep } from "./postprocess/PostProcessStep";

export interface ConvertOptions {
  postProcess?: PostProcessStep[];
  importSettings?: ImportSettings;
  exportSettings?: ExportSettings;
  compatibilityProfile?: CompatibilityProfileName;
}

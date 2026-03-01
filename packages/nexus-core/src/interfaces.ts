import type { AiScene } from "./types/scene";

export interface ImportWarning {
  code: string;
  message: string;
  context?: unknown;
}

export interface ImportSettings {
  mtlText?: string;
  motionBuffer?: ArrayBuffer;
  [key: string]: unknown;
}

export interface ExportSettings {
  format?: string;
  mtlFileName?: string;
  [key: string]: unknown;
}

export interface ImportResult {
  scene: AiScene;
  warnings: ImportWarning[];
}

export interface BaseImporter {
  canRead(buffer: ArrayBuffer, filename: string): boolean;
  read(buffer: ArrayBuffer, filename: string, settings?: ImportSettings): ImportResult;
}

export interface BaseExporter {
  getSupportedExtensions(): string[];
  write(scene: AiScene, settings?: ExportSettings): ArrayBuffer;
}

import type { ImportResult } from "nexus-core";
import {
  ModelConverter,
  IMPORTER_REGISTRY,
  ModelFormat,
  renderCompatibilityReportMarkdown,
  type ModelFormat as ModelFormatValue,
} from "nexus-converter";
import { createUi } from "./ui";

const ui = createUi();
const converter = new ModelConverter();
const fileInput = document.querySelector<HTMLInputElement>("#file-input")!;
const targetSelect = document.querySelector<HTMLSelectElement>("#target-format")!;
const compatibilityProfileSelect = document.querySelector<HTMLSelectElement>("#compat-profile")!;
const convertButton = document.querySelector<HTMLButtonElement>("#convert-button")!;
const dropzone = document.querySelector<HTMLDivElement>("#dropzone")!;

const supportedFormats = Object.values(ModelFormat);
let currentFile: File | null = null;
let currentFormat: ModelFormatValue | null = null;
let currentResult: ImportResult | null = null;

function detectFormat(fileName: string): ModelFormatValue {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension || !supportedFormats.includes(extension as ModelFormatValue)) {
    throw new Error(`Unsupported file extension: ${extension ?? "unknown"}`);
  }
  return extension as ModelFormatValue;
}

function nextTargetFormat(inputFormat: ModelFormatValue): ModelFormatValue {
  if (inputFormat === ModelFormat.PMX || inputFormat === ModelFormat.PMD || inputFormat === ModelFormat.VMD) {
    return ModelFormat.OBJ;
  }
  if (inputFormat === ModelFormat.OBJ) {
    return ModelFormat.FBX;
  }
  return ModelFormat.OBJ;
}

function syncTargetOptions(inputFormat: ModelFormatValue): void {
  targetSelect.replaceChildren();
  supportedFormats
    .filter((format) => format !== inputFormat)
    .forEach((format) => {
      const option = document.createElement("option");
      option.value = format;
      option.textContent = format.toUpperCase();
      targetSelect.append(option);
    });
  targetSelect.value = nextTargetFormat(inputFormat);
}

async function loadFile(file: File): Promise<void> {
  currentFile = file;
  currentFormat = detectFormat(file.name);
  syncTargetOptions(currentFormat);
  const buffer = await file.arrayBuffer();
  currentResult = IMPORTER_REGISTRY[currentFormat].read(buffer, file.name);
  ui.setStatus(`Loaded ${file.name} as ${currentFormat.toUpperCase()}.`);
  ui.setWarnings(currentResult.warnings);
  ui.setStats(currentResult);
  ui.setDownload("", null);
  ui.setCompatibilityReport(null);
}

async function convertCurrentFile(): Promise<void> {
  if (!currentFile || !currentFormat) {
    ui.setStatus("Choose a file first.");
    return;
  }

  const target = targetSelect.value as ModelFormatValue;
  const buffer = await currentFile.arrayBuffer();
  ui.setStatus(`Converting ${currentFile.name} -> ${target.toUpperCase()}...`);
  const result = converter.convertWithReport(buffer, currentFormat, target, {
    compatibilityProfile: compatibilityProfileSelect.value as never,
  });
  ui.setDownload(
    `${currentFile.name.replace(/\.[^.]+$/, "")}.${target}`,
    new Blob([result.output], { type: "application/octet-stream" }),
  );
  ui.setCompatibilityReport(result.report ? renderCompatibilityReportMarkdown(result.report) : null);
  ui.setStatus(`Converted ${currentFile.name} -> ${target.toUpperCase()}.`);
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    await loadFile(file);
  } catch (error) {
    ui.setStatus(error instanceof Error ? error.message : "Failed to load file.");
  }
});

convertButton.addEventListener("click", () => {
  void convertCurrentFile();
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragover");
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  void loadFile(file).catch((error) => {
    ui.setStatus(error instanceof Error ? error.message : "Failed to load file.");
  });
});

ui.setWarnings([]);
ui.setCompatibilityReport(null);

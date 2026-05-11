import { isCompatibilityProfileName, type CompatibilityProfileName, type ImportResult } from "@3d-nexus/core";
import { ModelConverter, IMPORTER_REGISTRY, ModelFormat, renderCompatibilityReportMarkdown, type ModelFormat as ModelFormatValue } from "@3d-nexus/converter";
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
let currentBinBuffer: ArrayBuffer | null = null;

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
  if (inputFormat === ModelFormat.BVH) {
    return ModelFormat.FBX;
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

function readCompatibilityProfile(): CompatibilityProfileName {
  const profile = compatibilityProfileSelect.value;
  if (!isCompatibilityProfileName(profile)) {
    throw new Error(`Unsupported compatibility profile: ${profile}`);
  }
  return profile;
}

function findPrimaryFile(files: FileList | File[]): File | null {
  return Array.from(files).find((file) => !file.name.toLowerCase().endsWith(".bin")) ?? null;
}

function findBinFile(files: FileList | File[], modelFile: File): File | null {
  const allFiles = Array.from(files);
  const baseName = modelFile.name.replace(/\.[^.]+$/, "").toLowerCase();
  return allFiles.find((file) => file.name.toLowerCase() === `${baseName}.bin`) ?? allFiles.find((file) => file.name.toLowerCase().endsWith(".bin")) ?? null;
}

async function loadFiles(files: FileList | File[]): Promise<void> {
  const file = findPrimaryFile(files);
  if (!file) {
    throw new Error("Choose a model file.");
  }
  currentFile = file;
  currentFormat = detectFormat(file.name);
  syncTargetOptions(currentFormat);
  const buffer = await file.arrayBuffer();
  const binFile = currentFormat === ModelFormat.GLTF ? findBinFile(files, file) : null;
  currentBinBuffer = binFile ? await binFile.arrayBuffer() : null;
  currentResult = IMPORTER_REGISTRY[currentFormat].read(buffer, file.name, currentBinBuffer ? { binBuffer: currentBinBuffer } : undefined);
  ui.setStatus(`Loaded ${file.name} as ${currentFormat.toUpperCase()}.`);
  ui.setWarnings(currentResult.warnings);
  ui.setStats(currentResult);
  ui.setDownloads([]);
  ui.setCompatibilityReport(null);
}

async function convertCurrentFile(): Promise<void> {
  if (!currentFile || !currentFormat) {
    ui.setStatus("Choose a file first.");
    return;
  }

  const target = targetSelect.value as ModelFormatValue;
  const compatibilityProfile = readCompatibilityProfile();
  const buffer = await currentFile.arrayBuffer();
  ui.setStatus(`Converting ${currentFile.name} -> ${target.toUpperCase()}...`);
  const result = converter.convertWithReport(buffer, currentFormat, target, {
    compatibilityProfile,
    ...(currentBinBuffer ? { importSettings: { binBuffer: currentBinBuffer } } : {}),
    ...(target === ModelFormat.GLTF ? { exportSettings: { binFileName: `${currentFile.name.replace(/\.[^.]+$/, "")}.bin` } } : {}),
  });
  ui.setDownloads([
    { fileName: `${currentFile.name.replace(/\.[^.]+$/, "")}.${target}`, blob: new Blob([result.output], { type: "application/octet-stream" }) },
    ...(result.sidecars ?? []).map((sidecar) => ({
      fileName: sidecar.fileName,
      blob: new Blob([sidecar.content], { type: "application/octet-stream" }),
    })),
  ]);
  ui.setCompatibilityReport(result.report ? renderCompatibilityReportMarkdown(result.report) : null);
  ui.setStatus(`Converted ${currentFile.name} -> ${target.toUpperCase()}.`);
}

fileInput.addEventListener("change", async () => {
  const files = fileInput.files;
  if (!files || files.length === 0) return;
  try {
    await loadFiles(files);
  } catch (error) {
    ui.setStatus(error instanceof Error ? error.message : "Failed to load file.");
  }
});

convertButton.addEventListener("click", () => {
  void convertCurrentFile().catch((error) => {
    ui.setStatus(error instanceof Error ? error.message : "Failed to convert file.");
  });
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
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;
  void loadFiles(files).catch((error) => {
    ui.setStatus(error instanceof Error ? error.message : "Failed to load file.");
  });
});

ui.setWarnings([]);
ui.setCompatibilityReport(null);

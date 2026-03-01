import type { ImportResult } from "nexus-core";

export interface UiHandle {
  setStatus(message: string): void;
  setWarnings(warnings: ImportResult["warnings"]): void;
  setStats(result: ImportResult | null): void;
  setDownload(fileName: string, blob: Blob | null): void;
}

function countFaces(result: ImportResult): number {
  return result.scene.meshes.reduce((sum, mesh) => sum + mesh.faces.length, 0);
}

function countVertices(result: ImportResult): number {
  return result.scene.meshes.reduce((sum, mesh) => sum + mesh.vertices.length, 0);
}

export function createUi(): UiHandle {
  const status = document.querySelector<HTMLParagraphElement>("#status")!;
  const warnings = document.querySelector<HTMLUListElement>("#warnings")!;
  const stats = document.querySelector<HTMLDivElement>("#stats")!;
  const download = document.querySelector<HTMLAnchorElement>("#download-link")!;
  let currentUrl: string | null = null;

  return {
    setStatus(message) {
      status.textContent = message;
    },
    setWarnings(items) {
      warnings.replaceChildren();
      if (items.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No warnings.";
        warnings.append(li);
        return;
      }
      items.forEach((warning) => {
        const li = document.createElement("li");
        li.textContent = `${warning.code}: ${warning.message}`;
        warnings.append(li);
      });
    },
    setStats(result) {
      stats.replaceChildren();
      if (!result) {
        return;
      }

      const values = [
        ["Vertices", String(countVertices(result))],
        ["Faces", String(countFaces(result))],
        ["Materials", String(result.scene.materials.length)],
        ["Animations", String(result.scene.animations.length)],
      ];

      values.forEach(([label, value]) => {
        const card = document.createElement("div");
        card.className = "stat";
        card.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
        stats.append(card);
      });
    },
    setDownload(fileName, blob) {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
      }
      if (!blob) {
        download.hidden = true;
        download.removeAttribute("href");
        return;
      }

      currentUrl = URL.createObjectURL(blob);
      download.href = currentUrl;
      download.download = fileName;
      download.hidden = false;
      download.textContent = `Download ${fileName}`;
    },
  };
}

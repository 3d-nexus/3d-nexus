import type { ImportResult } from "@3d-nexus/core";

export interface UiHandle {
  setStatus(message: string): void;
  setWarnings(warnings: ImportResult["warnings"]): void;
  setStats(result: ImportResult | null): void;
  setDownloads(files: Array<{ fileName: string; blob: Blob }>): void;
  setDownload(fileName: string, blob: Blob | null): void;
  setCompatibilityReport(markdown: string | null): void;
}

function countFaces(result: ImportResult): number {
  return result.scene.meshes.reduce((sum, mesh) => sum + mesh.faces.length, 0);
}

function countVertices(result: ImportResult): number {
  return result.scene.meshes.reduce((sum, mesh) => sum + mesh.vertices.length, 0);
}

function countJoints(result: ImportResult): number {
  let count = 0;
  const walk = (node: ImportResult["scene"]["rootNode"] | null | undefined): void => {
    if (!node) {
      return;
    }
    count += 1;
    node.children.forEach(walk);
  };
  walk(result.scene.rootNode);
  return Math.max(0, count - 1);
}

function countAnimatedChannels(result: ImportResult): number {
  return result.scene.animations.reduce((sum, animation) => sum + animation.channels.length, 0);
}

export function createUi(): UiHandle {
  const status = document.querySelector<HTMLParagraphElement>("#status")!;
  const warnings = document.querySelector<HTMLUListElement>("#warnings")!;
  const stats = document.querySelector<HTMLDivElement>("#stats")!;
  const download = document.querySelector<HTMLAnchorElement>("#download-link")!;
  const compatibilityReport = document.querySelector<HTMLPreElement>("#compat-report")!;
  let currentUrls: string[] = [];

  function clearDownloads(): void {
    currentUrls.forEach((url) => URL.revokeObjectURL(url));
    currentUrls = [];
    download.parentElement?.querySelectorAll<HTMLAnchorElement>('a.download[data-generated="true"]').forEach((link) => link.remove());
    download.hidden = true;
    download.removeAttribute("href");
    download.textContent = "";
    download.replaceChildren();
  }

  function setDownloadFiles(files: Array<{ fileName: string; blob: Blob }>): void {
    clearDownloads();
    if (files.length === 0) {
      return;
    }

    files.forEach(({ fileName, blob }, index) => {
      const url = URL.createObjectURL(blob);
      currentUrls.push(url);
      const link = index === 0 ? download : document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.textContent = `Download ${fileName}`;
      if (index > 0) {
        link.className = "download";
        link.dataset.generated = "true";
        download.after(link);
      }
    });
    download.hidden = false;
  }

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
        ["Joints", String(countJoints(result))],
        ["Channels", String(countAnimatedChannels(result))],
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
    setDownloads: setDownloadFiles,
    setDownload(fileName, blob) {
      setDownloadFiles(blob ? [{ fileName, blob }] : []);
    },
    setCompatibilityReport(markdown) {
      compatibilityReport.textContent = markdown ?? "No report yet.";
    },
  };
}

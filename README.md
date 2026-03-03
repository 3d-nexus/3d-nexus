# 3d-nexus

`3d-nexus` 是一个基于 `pnpm` workspace 的 3D 格式转换与兼容性验证仓库，当前聚焦于 `OBJ`、`FBX`、`PMX/PMD`、`VMD`、`BVH` 的导入、导出、浏览器内转换，以及面向 DCC/runtime profile 的 compatibility report。

## Workspace

| 路径 | 发布包名 | 作用 |
|---|---|---|
| `packages/nexus-core` | `@3d-nexus/core` | 通用 IR、数学类型、兼容性类型 |
| `packages/nexus-obj` | `@3d-nexus/obj` | OBJ / MTL 导入导出 |
| `packages/nexus-fbx` | `@3d-nexus/fbx` | FBX 导入导出、scene extras、animation、material fidelity |
| `packages/nexus-mmd` | `@3d-nexus/mmd` | PMX / PMD / VMD 导入导出与 MMD 相关保真逻辑 |
| `packages/nexus-bvh` | `@3d-nexus/bvh` | BVH skeleton/motion 解析、导入导出、frame timing fidelity |
| `packages/nexus-converter` | `@3d-nexus/converter` | 格式转换管线、post-process、compatibility report |
| `apps/playground` | private | 浏览器内加载、转换、下载、查看 compatibility report |

## 常用命令

```bash
pnpm install
pnpm --filter ./packages/nexus-mmd test
pnpm --filter ./packages/nexus-fbx test
pnpm --filter ./packages/nexus-converter test
pnpm --filter ./apps/playground build
pnpm release:check
```

## Compatibility Workflow

| 步骤 | 做什么 |
|---|---|
| 1 | 用对应 importer 读取 `PMX / VMD / FBX / OBJ / BVH` |
| 2 | 通过 `ModelConverter.convertWithReport()` 执行转换 |
| 3 | 传入 `compatibilityProfile` 生成 profile-aware report |
| 4 | 用 `renderCompatibilityReportMarkdown()` 渲染报告 |
| 5 | 在 `apps/playground` 中查看状态、诊断和下载结果 |

示例：

```ts
import { ModelConverter, ModelFormat, renderCompatibilityReportMarkdown } from "@3d-nexus/converter";

const converter = new ModelConverter();
const result = converter.convertWithReport(inputBuffer, ModelFormat.PMX, ModelFormat.FBX, {
  compatibilityProfile: "maya-fbx",
});

const markdown = result.report ? renderCompatibilityReportMarkdown(result.report) : "";
```

## Compatibility Profiles

| Profile | 说明 |
|---|---|
| `mmd` | PMX / VMD round-trip 优先 |
| `blender-fbx` | Blender FBX authoring/export 路径 |
| `maya-fbx` | Maya pivot / animation / material fidelity 路径 |
| `3dsmax-fbx` | 3ds Max negative scale / handedness 路径 |
| `motionbuilder-fbx` | MotionBuilder timing / animation stack 路径 |
| `unity` | runtime-oriented FBX compatibility |
| `unreal` | Unreal import-oriented FBX compatibility |
| `bvh` | BVH skeleton motion / frame timing / drift diagnostics 路径 |

更完整的语义说明见：

- [compatibility-profiles.md](C:/Workspace/Coding/nexus-3d/docs/compatibility-profiles.md)
- [compatibility-matrix.md](C:/Workspace/Coding/nexus-3d/docs/compatibility-matrix.md)

## 发布包

```bash
npm i @3d-nexus/core
npm i @3d-nexus/obj
npm i @3d-nexus/fbx
npm i @3d-nexus/mmd
npm i @3d-nexus/bvh
npm i @3d-nexus/converter
```

GitHub 仓库：[`3d-nexus/3d-nexus`](https://github.com/3d-nexus/3d-nexus)

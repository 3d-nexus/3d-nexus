# Nexus 3D

`Nexus 3D` 是一个基于 `pnpm` workspace 的 3D 格式转换与兼容性验证仓库，当前聚焦于 `OBJ`、`FBX`、`PMX/PMD`、`VMD`、`BVH` 的导入、导出、浏览器内转换，以及面向 DCC/runtime profile 的 compatibility report。

## Workspace

| 路径 | 作用 |
|---|---|
| `packages/nexus-core` | 通用 IR、数学类型、兼容性类型 |
| `packages/nexus-obj` | OBJ / MTL 导入导出 |
| `packages/nexus-fbx` | FBX 导入导出、scene extras、animation、material fidelity |
| `packages/nexus-mmd` | PMX / PMD / VMD 导入导出与 MMD 相关保真逻辑 |
| `packages/nexus-bvh` | BVH skeleton/motion 解析、导入导出、frame timing fidelity |
| `packages/nexus-converter` | 格式转换管线、post-process、compatibility report |
| `apps/playground` | 浏览器内加载、转换、下载、查看 compatibility report |
| `openspec` | 变更提案、主 specs、兼容矩阵规范 |
| `docs` | profile 语义与 capability/tool-version 兼容矩阵说明 |

## 常用命令

```bash
pnpm install
pnpm --filter nexus-mmd test
pnpm --filter nexus-fbx test
pnpm --filter nexus-converter test
pnpm --filter playground build
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
import { ModelConverter, ModelFormat, renderCompatibilityReportMarkdown } from "nexus-converter";

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

## Playground

`apps/playground` 支持：

| 能力 | 说明 |
|---|---|
| 文件拖拽/选择 | 加载 `.obj` `.fbx` `.pmx` `.pmd` `.vmd` `.bvh` |
| 输出格式选择 | 浏览器内转换并下载 |
| Compatibility Profile 选择 | 切换报告目标 profile |
| Compatibility Report 面板 | 查看 `exact / normalized / degraded / unsupported` 结果 |
| Scene Stats | 对 meshless BVH scene 显示 joints / channels / animations |

启动方式：

```bash
pnpm --filter playground dev
```

## OpenSpec

当前工业级 FBX/PMX 兼容矩阵 change 已归档到：

- `openspec/changes/archive/2026-03-02-fbx-pmx-full-dcc-compat-matrix`

主 specs 已同步回：

- `openspec/specs`

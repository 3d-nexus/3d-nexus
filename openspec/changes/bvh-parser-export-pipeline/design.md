## Context

仓库当前已经有一条比较稳定的方法链路：`parser/importer -> nexus-core IR -> exporter -> nexus-converter -> compatibility report -> playground`。`FBX`、`PMX/PMD`、`VMD` 已经沿着这条链路实现了格式解析、导出、跨格式转换、兼容性诊断和浏览器内验证，而 `BVH` 还没有进入这套体系。

`BVH` 的特殊点在于它天然是 frame-based skeleton motion 格式，强调 joint hierarchy、channel order、Euler rotation order、root translation 和 `Frame Time`，而不是 mesh/material。设计需要在不破坏现有 IR 的前提下，把这些语义映射为可 round-trip 的 metadata，并复用已有 converter/report/playground 机制。

## Goals / Non-Goals

**Goals:**
- 新增一条与现有格式一致的 `BVH` parser/exporter 方法链路。
- 把 `BVH` skeleton hierarchy、channel layout、frame timing、rotation order、root motion 映射到 `nexus-core` IR 与 metadata。
- 让 `BVH` 能进入 `nexus-converter`，参与 `BVH <-> FBX/PMX/VMD` 的转换与 compatibility report 输出。
- 把 `BVH` 纳入 fixture、roundtrip、cross-format、playground 验证链路。

**Non-Goals:**
- 不在本 change 内引入完整的人体 retargeting、骨骼重命名自动匹配或 IK 解算。
- 不把 `BVH` 扩展成 mesh/material 容器格式。
- 不在这一轮实现 DCC 插件级的 per-tool 骨骼约定修复逻辑，只要求 compatibility report 能显式标出归一化或降级。

## Decisions

### 1. 新增独立 `nexus-bvh` 包，而不是把 BVH 塞进 `nexus-mmd`
选择新增 `packages/nexus-bvh`，内部包含 `BVHParser`、`BVHImporter`、`BVHExporter`。

原因：
- `BVH` 与 `PMX/VMD` 同为动画驱动格式，但数据模型和关注点不同。
- 单独成包更符合现有 `nexus-obj` / `nexus-fbx` / `nexus-mmd` 的组织方式。
- converter 注册、测试夹具、后续扩展会更清晰。

备选：
- 复用 `nexus-mmd`。缺点是把 MMD 专属逻辑和通用 mocap 格式耦死，后续维护成本高。

### 2. 使用 `AiNode` + `AiAnimation` 承载 BVH 结构，BVH 原生字段保留在 metadata
BVH hierarchy 映射到 `scene.rootNode` 及其子节点；motion frames 映射到 `AiAnimation.channels`；BVH 原生 channel 顺序、Euler order、frame index、frame time 保留在 `bvh:*` metadata。

原因：
- 复用现有 IR，避免为了单一格式再引入平行场景模型。
- 现有 `VMD` 已经证明 frame-based 动画可以通过 metadata + IR keyframes 的方式稳定 round-trip。
- exporter 可根据 metadata 重建 BVH 文本顺序和语义。

备选：
- 在 `nexus-core` 引入专用 `BvhDocument`-style runtime 类型。缺点是会扩大全仓抽象面，而且对 converter 和 playground 复用帮助有限。

### 3. 把 BVH 兼容性分成“骨架/运动”和“动画保真”两类 capability
`bvh-skeleton-motion` 负责 hierarchy、offset、channel layout、Frame Time、motion count；`bvh-animation-fidelity` 负责 Euler order、frame index、root motion 和 normalization drift；`bvh-conversion-workflow` 负责 converter/report/playground 集成。

原因：
- 这与现有 FBX/PMX 拆 capability 的方法一致，方便测试和 compatibility report 精确落点。
- skeleton 结构问题和 timing/fidelity 问题在实现和验证上是两套风险面。

### 4. BVH compatibility profile 走 `dcc-compatibility-matrix` 的扩展路径
不为 BVH 单独建一套报告系统，而是在现有 compatibility fixture/report schema 中新增 BVH profile、capability 和 diagnostics。

原因：
- 现有 report 已支持 `exact / normalized / degraded / unsupported` 四级结果。
- playground 和 converter 已有接口，增加 BVH 后不需要额外 UI 或存储模型。

### 5. 导出优先保证“稳定重建”，而不是隐式纠正骨骼约定
如果 IR 缺少 BVH 所需的 channel order / Euler order / root motion 语义，exporter 应输出 canonical BVH，并在 compatibility report 中标记为 `normalized` 或 `degraded`，而不是做不可追踪的隐式修复。

原因：
- 与当前 FBX/PMX compatibility strategy 一致。
- 便于定位跨格式损失，不把不确定行为藏在 exporter 内。

## Risks / Trade-offs

- `[Risk] BVH 的 Euler order 与现有 IR quaternion/keyframe 表达之间存在信息折损` → `Mitigation`: 在 importer/exporter 两端保留 `bvh:rotationOrder` 与原始 channel metadata，并在 compatibility report 中显式诊断 normalization。
- `[Risk] BVH 只有 skeleton/motion，没有 mesh，可能与部分现有转换测试假设不一致` → `Mitigation`: 在 converter 和 playground 中补充无 mesh 场景路径，使用 animation-first 统计与报告。
- `[Risk] 不同 BVH 生产工具对 root channel、End Site、命名存在差异` → `Mitigation`: 用 canonical fixture 覆盖常见 authoring 变体，并把不一致点沉淀为 fixture profile 和 diagnostics。
- `[Risk] BVH <-> PMX/VMD/FBX` 转换天然存在语义不对等` → `Mitigation`: 通过 capability report 定义 exact/normalized/degraded 边界，而不是承诺全等。

## Migration Plan

- 第 1 步：新增 `packages/nexus-bvh`，实现 parser/importer/exporter 和基础 tests。
- 第 2 步：在 `nexus-core` / `nexus-converter` 中注册 `bvh` format、兼容性 profile 与 report 逻辑。
- 第 3 步：加入 cross-format fixtures、roundtrip tests、playground 集成和文档说明。
- 回滚策略：若 BVH 管线不稳定，可只回退 `nexus-bvh` 注册和 converter exposure，不影响现有 FBX/PMX/MMD/OBJ 能力。

## Open Questions

- 是否需要在本轮就支持多个常见 BVH authoring profile，例如 `mixamo-bvh`、`motionbuilder-bvh`，还是先以单一 canonical `bvh` profile 起步。
- `BVH -> PMX/VMD` 转换时，骨骼命名与旋转轴差异是仅报告降级，还是在后续 change 再做 profile-specific mapping。

## Why

当前仓库已经具备 `OBJ`、`FBX`、`PMX/PMD`、`VMD` 的解析、导出和 compatibility workflow，但还缺少动作捕捉领域最常见的 `BVH` 管线。为了复用现有 `nexus-core` IR、`nexus-converter` 转换链路、compatibility report 和 playground 验证方式，需要用和前面 FBX/PMX 相同的方法链路，把 `BVH` 的解析、生成和跨格式转换正式纳入 OpenSpec。

## What Changes

- 新增 `BVH` 导入能力，支持解析 hierarchy、joint channel 定义、motion frames、frame time 和欧拉旋转顺序。
- 新增 `BVH` 导出能力，能够从现有骨架和动画 IR 生成稳定、可 round-trip 的 `.bvh` 输出。
- 新增 `BVH` 对 `nexus-core` IR 的映射约定，包括 skeleton hierarchy、channel metadata、frame-based motion semantics 和单位/轴向元数据。
- 新增 `BVH` 与现有 `FBX` / `PMX` / `VMD` 的转换与 compatibility report 规则，明确哪些语义是 `exact`、`normalized`、`degraded`。
- 将 `BVH` 纳入 browser playground 与仓内测试夹具体系，形成和现有工业链路一致的验证闭环。

## Capabilities

### New Capabilities
- `bvh-skeleton-motion`: 定义 BVH hierarchy、joint offset、channel layout、motion frame 和 frame-time 解析/导出行为。
- `bvh-animation-fidelity`: 定义 BVH 欧拉旋转顺序、frame-index 语义、root motion 和 time normalization 的保真与诊断规则。
- `bvh-conversion-workflow`: 定义 BVH 与现有 IR/格式之间的转换、compatibility report 输出和 playground 验证流程。

### Modified Capabilities
- `dcc-compatibility-matrix`: 扩展 compatibility profile、fixture manifest 和 report 规则，使其覆盖 BVH parser/export pipeline。

## Impact

- 受影响包：`packages/nexus-core`、`packages/nexus-converter`，以及新增的 `packages/nexus-bvh` 或等价 BVH 包实现。
- 受影响验证面：compatibility fixtures、cross-format tests、playground compatibility report 展示。
- 需要新增 BVH fixture、roundtrip 测试、parser/exporter 单测，以及文档中的 profile / capability 矩阵说明。

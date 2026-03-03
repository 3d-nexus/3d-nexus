## 1. Package Scaffold And Format Registration

- [x] 1.1 创建 `packages/nexus-bvh` 包结构、构建配置和公开入口
- [x] 1.2 在 `nexus-converter` format registry 中注册 `bvh` import/export 能力
- [x] 1.3 在共享类型与测试工具中加入 BVH 所需的 metadata key 与 format 常量
- [x] 1.4 新增最小 BVH fixture 与包级基础 smoke test

## 2. BVH Parser

- [x] 2.1 实现 `BVHParser`，解析 `HIERARCHY` 中的 `ROOT`、`JOINT`、`End Site`、`OFFSET`
- [x] 2.2 解析并保留每个 joint 的 `CHANNELS` 数量、顺序和 Euler rotation order
- [x] 2.3 解析 `MOTION`、`Frames`、`Frame Time` 和逐帧 channel 数值
- [x] 2.4 为 malformed BVH、channel count 不匹配和 hierarchy 异常添加 parser 单测

## 3. BVH Importer To IR

- [x] 3.1 将 BVH hierarchy 映射到 `AiNode` 树并保留 `bvh:*` 结构 metadata
- [x] 3.2 将 frame-based motion 映射到 `AiAnimation.channels` 与 root motion keyframes
- [x] 3.3 保留 `Frame Time`、original frame index、channel order、rotation order 到 scene/node metadata
- [x] 3.4 添加 importer roundtrip fixture tests，覆盖 root motion、End Site 和 rotation order

## 4. BVH Exporter

- [x] 4.1 实现 `BVHExporter`，从 IR skeleton 和 animation 生成稳定的 `HIERARCHY` 文本
- [x] 4.2 使用保留的 `bvh:*` metadata 重建 joint channel order、rotation order、End Site 与 frame timing
- [x] 4.3 在 metadata 缺失时输出 canonical BVH hierarchy/channel layout
- [x] 4.4 为 import -> export -> import roundtrip 添加 parser/exporter 一致性测试

## 5. BVH Animation Fidelity

- [x] 5.1 保留 BVH frame index 语义，避免 time normalization 后静默漂移
- [x] 5.2 为 off-frame 编辑或无法精确回写的场景增加 drift diagnostics 模型
- [x] 5.3 验证 frame time、frame count、root translation 与 Euler order 的 roundtrip 保真
- [x] 5.4 添加 byte-stable 或 text-stable 导出测试，确保未编辑场景的 BVH 导出稳定

## 6. Converter And Compatibility Reporting

- [x] 6.1 在 `nexus-converter` 中暴露 `convertWithReport()` 的 BVH 输入输出路径
- [x] 6.2 为 `dcc-compatibility-matrix` 扩展 `bvh` profile、fixture manifest 和 capability 映射
- [x] 6.3 为 `BVH -> FBX`、`FBX -> BVH`、`BVH -> PMX/VMD` 的归一化/降级场景增加 compatibility checks
- [x] 6.4 添加 converter tests，验证 BVH report 中的 `exact`、`normalized`、`degraded` 输出

## 7. Cross-Format Bridge

- [ ] 7.1 定义 BVH 与 `FBX` skeleton/animation IR 映射规则并添加 regression tests
- [ ] 7.2 定义 BVH 与 `PMX/VMD` frame-based animation 映射规则并添加 diagnostics
- [ ] 7.3 处理无 mesh BVH scene 在 converter/playground 中的统计与展示路径
- [ ] 7.4 增加至少一个 BVH cross-format smoke test，覆盖导入、转换、导出闭环

## 8. Playground And Fixtures

- [ ] 8.1 在 browser playground 中支持 `.bvh` 文件加载、格式选择和 compatibility profile 选择
- [ ] 8.2 在 playground 中显示 BVH 相关 compatibility report 与 diagnostics
- [ ] 8.3 增加 canonical BVH fixtures，覆盖 basic skeleton、root motion、不同 rotation order
- [ ] 8.4 添加面向 playground 的验证测试或手工验证脚本说明

## 9. Documentation And Validation

- [ ] 9.1 更新根目录与 `docs` 中的 format support / compatibility workflow 文档，纳入 BVH
- [ ] 9.2 在 compatibility matrix 文档中加入 BVH profile、能力范围、已知 gaps
- [ ] 9.3 运行 `nexus-bvh`、`nexus-converter`、`playground` 的测试与构建验证
- [ ] 9.4 通过 `openspec validate "bvh-parser-export-pipeline" --type change --strict` 校验 change 完整性

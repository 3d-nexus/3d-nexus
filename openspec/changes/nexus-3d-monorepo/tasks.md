## 1. Monorepo Scaffold

- [x] 1.1 Create root `package.json` with pnpm workspaces config (`"workspaces": ["packages/*", "apps/*"]`), scripts (`build`, `test`, `dev`), and dev dependencies (`typescript`, `vite`, `vitest`, `vite-plugin-dts`)
- [x] 1.2 Create `pnpm-workspace.yaml` listing `packages/*` and `apps/*`
- [x] 1.3 Create `tsconfig.base.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `moduleResolution: bundler`, `target: ES2020`
- [x] 1.4 Create `vite.config.base.ts` with shared library build defaults (ESM format, external peer deps helper)
- [x] 1.5 Create `.gitignore` covering `node_modules`, `dist`, `.turbo`
- [x] 1.6 Run `pnpm install` at root to verify workspace linkage

## 2. nexus-core — IR Types & Math

- [x] 2.1 Scaffold `packages/nexus-core/` with `package.json`, `tsconfig.json` (extends base), `vite.config.ts`, `vitest.config.ts`
- [x] 2.2 Create `src/types/math.ts` — `AiVector2D`, `AiVector3D`, `AiColor3D`, `AiColor4D`, `AiQuaternion`, `AiMatrix3x3`, `AiMatrix4x4` (column-major Float32Array), `AiAABB`
- [x] 2.3 Create `src/types/mesh.ts` — `AiPrimitiveType` enum, `AiFace`, `AiVertexWeight`, `AiBone`, `AiAnimMesh`, `AiMesh`
- [x] 2.4 Create `src/types/material.ts` — `AiTextureType` enum, `AiTextureMapping` enum, `AiPropertyTypeInfo` enum, `AiMaterialProperty`, `AiMaterial`, `AiUVTransform`
- [x] 2.5 Create `src/types/anim.ts` — `AiAnimBehaviour` enum, `AiAnimInterpolation` enum, `AiVectorKey`, `AiQuatKey`, `AiMeshKey`, `AiMeshMorphKey`, `AiNodeAnim`, `AiMeshAnim`, `AiMeshMorphAnim`, `AiAnimation`
- [x] 2.6 Create `src/types/texture.ts` — `AiTexture`
- [x] 2.7 Create `src/types/light.ts` — `AiLightSourceType` enum, `AiLight`
- [x] 2.8 Create `src/types/camera.ts` — `AiCamera`
- [x] 2.9 Create `src/types/metadata.ts` — `AiMetadataType` enum, `AiMetadataEntry`, `AiMetadata`
- [x] 2.10 Create `src/types/scene.ts` — `AiSceneFlags` enum, `AiNode`, `AiScene`
- [x] 2.11 Create `src/interfaces.ts` — `ImportSettings`, `ExportSettings`, `ImportWarning`, `ImportResult`, `BaseImporter`, `BaseExporter`
- [x] 2.12 Create `src/math/utils.ts` — `createIdentityMatrix4x4()`, `multiplyMatrix4x4()`, `invertMatrix4x4()`, `transformVector3()`, `normalizeVector3()`
- [x] 2.13 Create `src/index.ts` re-exporting all public types and utilities
- [x] 2.14 Build `nexus-core` (`vite build`) and verify `dist/index.js` + `dist/index.d.ts` are generated

## 3. nexus-obj — OBJ/MTL Parser & Exporter

- [ ] 3.1 Scaffold `packages/nexus-obj/` with `package.json` (`nexus-core: workspace:*`), `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- [ ] 3.2 Create `src/ObjFileData.ts` — `ObjFace`, `ObjObject`, `ObjMaterial`, `ObjModel` internal DOM types (mirrors assimp `ObjFileData.h`)
- [ ] 3.3 Create `src/ObjFileMtlParser.ts` — parses MTL text into `ObjMaterial[]`; handles `newmtl`, `Ka`, `Kd`, `Ks`, `Ke`, `Ns`, `Ni`, `d`, `Tr`, `illum`, `map_Kd`, `map_Ka`, `map_Ks`, `map_Ns`, `map_bump`, `bump`, `map_d`, `disp`
- [ ] 3.4 Create `src/ObjFileParser.ts` — line-by-line OBJ tokeniser; dispatches on `v`, `vn`, `vt`, `f`, `o`, `g`, `usemtl`, `mtllib`, `s`, `#`; handles negative index references and `f v//n` format
- [ ] 3.5 Create `src/ObjFileImporter.ts` — converts `ObjModel` DOM → `AiScene` IR; one mesh per material group; creates default material when MTL is missing; emits `ImportWarning` for missing MTL
- [ ] 3.6 Create `src/ObjExporter.ts` — converts `AiScene` IR → OBJ text + MTL text; exposes `getMtlContent(): string`; includes `mtllib` directive; handles meshes with no normals
- [ ] 3.7 Add fixture files `src/__tests__/fixtures/cube.obj`, `cube.mtl`
- [ ] 3.8 Create `src/__tests__/ObjFileParser.test.ts` — tests vertex parsing, face formats, negative indices, comment skipping
- [ ] 3.9 Create `src/__tests__/ObjFileMtlParser.test.ts` — tests `Kd`, `map_Kd`, `d` parsing
- [ ] 3.10 Create `src/__tests__/roundtrip.test.ts` — parse `cube.obj`, export to OBJ, re-parse, assert vertex and face counts match
- [ ] 3.11 Create `src/index.ts` exporting `ObjFileImporter`, `ObjExporter`
- [ ] 3.12 Build and run `vitest run` — all tests pass

## 4. nexus-mmd — PMX / PMD / VMD Parser & Exporter

- [ ] 4.1 Scaffold `packages/nexus-mmd/` with `package.json` (`nexus-core: workspace:*`), `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- [ ] 4.2 Create `src/BinaryReader.ts` — `DataView`-backed cursor reader with `readUint8/16/32`, `readInt8/16/32`, `readFloat32`, `readFloat64`, `readString(len, encoding)`, `readIndex(size)` helpers
- [ ] 4.3 Create `src/MMDPmxParser.ts` — full PMX 2.0/2.1 binary parser; `PmxSetting`, `PmxVertex` (all 5 skinning types: BDEF1/2/4, SDEF, QDEF), `PmxMaterial`, `PmxBone` (with IK chain), `PmxMorph` (vertex/UV/bone/material/group), `PmxFrame`, `PmxRigidBody`, `PmxJoint`, `PmxSoftBody`; validates `PMX ` magic
- [ ] 4.4 Create `src/MMDPmdParser.ts` — PMD binary parser; validates `Pmd` magic; Shift_JIS decode via lookup table for bone/morph names; `PmdHeader`, `PmdVertex`, `PmdMaterial`, `PmdBone`, `PmdIk`, `PmdMorph`
- [ ] 4.5 Create `src/MMDVmdParser.ts` — VMD binary parser; validates magic string; `VmdBoneFrame` (with 4×4×4 bezier interpolation bytes), `VmdMorphFrame`, `VmdCameraFrame`, `VmdLightFrame`, `VmdShadowFrame`, `VmdIkFrame`
- [ ] 4.6 Create `src/MMDImporter.ts` — implements `BaseImporter`; detects format by magic bytes; maps PMX/PMD to `AiScene` (bones → `AiNode` hierarchy, morphs → `AiAnimMesh[]`, materials → `AiMaterial[]`); merges VMD keyframes into `AiAnimation` when `ImportSettings.motionBuffer` is provided; stashes rigid-body data in `scene.metadata["mmd:rigidBodies"]`; emits `ImportWarning` for unmatched VMD bones
- [ ] 4.7 Create `src/MMDPmxExporter.ts` — writes `AiScene` → PMX 2.0 binary via `DataView`
- [ ] 4.8 Create `src/MMDVmdExporter.ts` — writes `AiScene` first `AiAnimation` → VMD binary
- [ ] 4.9 Create `src/MMDExporter.ts` — implements `BaseExporter`; routes to PMX or VMD exporter via `ExportSettings.format`
- [ ] 4.10 Add fixture binary `src/__tests__/fixtures/minimal.pmx` (hand-crafted minimal valid PMX), `minimal.vmd`
- [ ] 4.11 Create `src/__tests__/MMDPmxParser.test.ts` — parses `minimal.pmx`; asserts vertex count, bone count, material count, PMX magic validation error on bad input
- [ ] 4.12 Create `src/__tests__/MMDVmdParser.test.ts` — parses `minimal.vmd`; asserts bone frame count, morph frame count
- [ ] 4.13 Create `src/__tests__/roundtrip.test.ts` — PMX → IR → PMX; assert vertex count preserved
- [ ] 4.14 Create `src/index.ts` exporting `MMDImporter`, `MMDExporter`
- [ ] 4.15 Build and run `vitest run` — all tests pass

## 5. nexus-fbx — FBX Parser & Exporter

- [ ] 5.1 Scaffold `packages/nexus-fbx/` with `package.json` (`nexus-core: workspace:*`, `fflate` runtime dep), `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- [ ] 5.2 Create `src/FBXTokenizer.ts` — shared `FBXToken` types: `NodeBegin`, `NodeEnd`, `Data` (with value: `string | number | boolean | bigint | ArrayBuffer | TypedArray`)
- [ ] 5.3 Create `src/FBXBinaryTokenizer.ts` — reads binary FBX; validates 23-byte Kaydara magic; reads node records with 32-bit (< 7500) or 64-bit (>= 7500) offsets; decompresses property arrays with `fflate.inflateSync`
- [ ] 5.4 Create `src/FBXAsciiTokenizer.ts` — tokenises ASCII FBX text; handles `NodeName: {`, property lines, string escaping (`\n`, `\t`, `\\`)
- [ ] 5.5 Create `src/FBXParser.ts` — converts flat token stream → nested `FBXElement` tree (name, properties[], children[])
- [ ] 5.6 Create `src/FBXProperties.ts` — `PropertyTable` class wrapping `Properties70` element; typed getters returning `string | number | boolean | AiVector3D | AiColor4D`
- [ ] 5.7 Create `src/FBXDocument.ts` — `FbxDocument` with `objects: Map<bigint, LazyFbxObject>` (lazy-parsed subtypes); `connections` bidirectional graph; subtypes: `FbxModel`, `FbxGeometry`, `FbxMaterial`, `FbxTexture`, `FbxVideo`, `FbxDeformer` (Skin/Cluster/BlendShape/BlendShapeChannel), `FbxAnimationStack`, `FbxAnimationLayer`, `FbxAnimationCurveNode`, `FbxAnimationCurve`
- [ ] 5.8 Create `src/FBXConverter.ts` — traverses `FbxDocument` → `AiScene`; resolves coordinate system from `GlobalSettings`; converts `FbxGeometry` → `AiMesh` (handles `ByVertice`/`ByPolygonVertex`/`ByPolygon` mapping modes for normals/UVs); converts `Skin`/`Cluster` → `AiBone`; converts `BlendShape` → `AiAnimMesh`; converts `AnimationStack` → `AiAnimation`
- [ ] 5.9 Create `src/FBXImporter.ts` — implements `BaseImporter`; detects binary vs ASCII by magic; delegates to tokeniser → parser → document → converter
- [ ] 5.10 Create `src/FBXExportNode.ts` — `FbxExportNode` helper for building FBX ASCII node strings with typed properties
- [ ] 5.11 Create `src/FBXExportProperty.ts` — serialises typed FBX property values to ASCII string representation
- [ ] 5.12 Create `src/FBXExporter.ts` — implements `BaseExporter`; serialises `AiScene` to FBX 7.4 ASCII; writes `FBXHeaderExtension`, `GlobalSettings`, `Objects` (Geometry with negated last polygon index, Material with Properties70, NodeAttribute, Model), `Connections`, `Takes`
- [ ] 5.13 Add fixture files `src/__tests__/fixtures/cube.fbx` (ASCII FBX 7.4), `cube_binary.fbx` (binary FBX 7.4)
- [ ] 5.14 Create `src/__tests__/FBXBinaryTokenizer.test.ts` — validates magic check, compressed array decompression, 64-bit offset detection
- [ ] 5.15 Create `src/__tests__/FBXConverter.test.ts` — parses `cube.fbx`; asserts 1 mesh, 8 vertices, 6 face quads (or 12 triangles if triangulated), correct material name
- [ ] 5.16 Create `src/__tests__/roundtrip.test.ts` — parse ASCII FBX → IR → export ASCII FBX → re-parse; assert mesh name and vertex count preserved
- [ ] 5.17 Create `src/index.ts` exporting `FBXImporter`, `FBXExporter`
- [ ] 5.18 Build and run `vitest run` — all tests pass

## 6. nexus-converter — Conversion Pipeline

- [ ] 6.1 Scaffold `packages/nexus-converter/` with `package.json` (deps: `nexus-core`, `nexus-obj`, `nexus-mmd`, `nexus-fbx` all `workspace:*`), `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- [ ] 6.2 Create `src/formats.ts` — `ModelFormat` union type `"obj" | "fbx" | "pmx" | "pmd" | "vmd"` and `IMPORTER_REGISTRY`, `EXPORTER_REGISTRY` maps
- [ ] 6.3 Create `src/postprocess/TriangulateStep.ts` — fan-triangulates all non-triangle faces in every mesh
- [ ] 6.4 Create `src/postprocess/GenerateNormalsStep.ts` — computes flat per-face normals for meshes with empty `normals` array
- [ ] 6.5 Create `src/postprocess/FlipUVsStep.ts` — inverts V channel: `uv.y = 1 - uv.y`
- [ ] 6.6 Create `src/postprocess/SortByPTypeStep.ts` — splits meshes by `AiPrimitiveType` into separate meshes (points / lines / triangles)
- [ ] 6.7 Create `src/postprocess/OptimizeMeshesStep.ts` — merges meshes sharing the same material into one mesh
- [ ] 6.8 Create `src/ConvertOptions.ts` — `ConvertOptions` interface with `postProcess?: PostProcessStep[]`, `importSettings?: ImportSettings`, `exportSettings?: ExportSettings`
- [ ] 6.9 Create `src/ModelConverter.ts` — `convert(input, fromFormat, toFormat, options?)` method: lookup importer → `read()` → apply each `postProcess` step → lookup exporter → `write()`; throws `ConversionError` for unknown formats
- [ ] 6.10 Create `src/__tests__/ModelConverter.test.ts` — OBJ→OBJ round-trip (vertex count preserved), OBJ→FBX (produces non-empty ArrayBuffer), `TriangulateStep` converts quads to tris
- [ ] 6.11 Create `src/__tests__/postprocess.test.ts` — unit tests for each `PostProcessStep` in isolation
- [ ] 6.12 Create `src/index.ts` exporting `ModelConverter`, `ModelFormat`, `ConvertOptions`, `ConversionError`, `TriangulateStep`, `GenerateNormalsStep`, `FlipUVsStep`, `SortByPTypeStep`, `OptimizeMeshesStep`
- [ ] 6.13 Build and run `vitest run` — all tests pass

## 7. Playground App

- [ ] 7.1 Scaffold `apps/playground/` with `package.json` (deps: all nexus packages `workspace:*`), `tsconfig.json`, `vite.config.ts`, `index.html`
- [ ] 7.2 Create `src/main.ts` — drag-and-drop file input UI; detect format by file extension; call `ModelConverter.convert()` and offer the result as a download
- [ ] 7.3 Create `src/ui.ts` — display conversion status, warnings list, and basic mesh stats (vertex count, face count, material count, animation count)
- [ ] 7.4 Wire up `vite dev` and verify all packages load correctly via workspace symlinks in the browser
- [ ] 7.5 Manual integration test: drag a `.pmx` file → convert to OBJ → download and inspect in a 3D viewer

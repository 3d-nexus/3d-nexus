## Context

This change builds on the existing nexus-3d monorepo foundations. The `nexus-core` IR is stable and complete. The `nexus-mmd` and `nexus-fbx` packages have working binary/text parsers and DOM layers, but their importer-to-IR and IR-to-binary exporter layers are stub-grade. No new packages are introduced — all work is confined to extending existing source files within `packages/nexus-mmd/src/` and `packages/nexus-fbx/src/`.

Reference sources used for protocol details:
- `C:\Workspace\Coding\assimp-master\assimp-master\code\AssetLib\MMD\MMDPmxParser.h` — PMX 2.0/2.1 full struct definitions
- `C:\Workspace\Coding\assimp-master\assimp-master\code\AssetLib\MMD\MMDVmdParser.h` — VMD frame struct definitions
- `C:\Workspace\Coding\assimp-master\assimp-master\code\AssetLib\FBX\FBXConverter.cpp` — FBX→IR conversion reference
- `C:\Workspace\Coding\assimp-master\assimp-master\code\AssetLib\FBX\FBXDocument.h` — FBX DOM hierarchy
- `C:\Workspace\Coding\assimp-master\assimp-master\code\AssetLib\FBX\FBXDeformer.cpp` — Skin/Cluster/BlendShape parsing

---

## Goals / Non-Goals

**Goals:**
- Fix all critical correctness bugs in PMX skinning, morph targets, and VMD interpolation.
- Implement FBX skinning, animation, BlendShape extraction and export.
- Implement FBX coordinate system normalization and full material/texture pipeline.
- Make all importers and exporters handle arbitrary numbers of meshes.
- Preserve physics and extended metadata in round-trips.

**Non-Goals:**
- FBX binary write format (ASCII 7.4 only — binary write deferred).
- GPU skinning bake-down (SDEF coefficients stored, not evaluated).
- Realtime physics simulation of PMX rigid bodies.
- PMX 2.1 soft body export (import only).
- New format support beyond PMX/FBX/VMD.

---

## Decisions

### D1 — BDEF weight normalization strategy
**Decision**: After accumulating all weights for a vertex, compute `sum = Σwᵢ`. If `sum > ε` (ε = 1e-6), divide each weight by sum. Store `{ vertexId, weight }` entries only for `weight > ε` (skip zero-weight entries).
**Rationale**: Some PMX authors do not normalize weights. Passing un-normalized weights downstream causes incorrect deformation in any consumer. Filtering near-zero weights reduces AiBone array bloat.
**Alternative considered**: Clamp to [0, 1] range only — insufficient for unnormalized quad weights.

### D2 — SDEF coefficients storage in AiBone.ikChain
**Decision**: SDEF-skinned vertices store dual-quaternion blend params in `AiBone.ikChain` as `{ type: "sdef", c: AiVector3D, r0: AiVector3D, r1: AiVector3D }`. The two SDEF bones are mapped as normal BDEF2 entries in `AiVertexWeight[]` (same indices/weights), and the extra coefficients ride in `ikChain`.
**Rationale**: `AiMesh` has no per-vertex extended field. `AiBone.ikChain` is typed as `unknown` and already intended for format-specific extensions. This avoids a breaking IR change.
**Alternative considered**: Adding `sdefCoeffs: Map<vertexId, SdefCoeffs>` to `AiMesh` — breaks the existing IR interface.

### D3 — Morph storage model in IR
**Decision**:
- **Vertex morphs**: `AiAnimMesh` (one per PMX morph) with `vertices[]` holding the *absolute* deformed positions (`base + delta`). `name` = PMX morph name JP/EN.
- **UV morphs**: `AiAnimMesh.textureCoords[0]` holds the UV delta values (not absolute UVs); `AiAnimMesh.name` prefixed `"UV:"` to distinguish.
- **Bone, material, group morphs**: stored as JSON in `AiScene.metadata["mmd:boneMorphs"]`, `"mmd:materialMorphs"`, `"mmd:groupMorphs"]` as `AiMetadataEntry` with `type: AiMetadataType.AISTRING` (JSON string).
**Rationale**: Vertex morphs are geometry data that maps naturally to `AiAnimMesh`. Non-vertex morphs (bone pose offsets, material color multipliers, group cascades) have no IR equivalent — metadata is the escape hatch.
**Alternative considered**: Separate IR types for each morph category — scope creep, would require nexus-core changes.

### D4 — FBX time tick constant
**Decision**: Use `FBX_TICKS_PER_SECOND = 46186158000n` (BigInt). `KeyTime` values in FBX are stored as `int64`; reading them as BigInt via `DataView.getBigInt64` avoids precision loss. Division converts to `number` for `AiVectorKey.time`.
**Rationale**: 46186158000 exceeds `Number.MAX_SAFE_INTEGER` when multiplied by a frame index, so BigInt arithmetic is required for the intermediate calculation.

### D5 — FBX Euler → Quaternion conversion order
**Decision**: FBX default rotation order is `EulerXYZ` (applied as Z then Y then X, i.e., extrinsic XYZ). The `RotationOrder` property on the Model node overrides this. Implementation: read rotation order from `Properties70`, convert Euler angles (degrees → radians) per axis, compose quaternion in the specified order. Default = ZYX extrinsic.
**Rationale**: Assimp's `FBXConverter.cpp` reads `RotationOrder` per node (default `eEulerXYZ = 0`). Ignoring rotation order produces incorrect orientations for non-default models (~15% of production FBX files).

### D6 — FBX coordinate system axis-swap
**Decision**: Read `GlobalSettings.UpAxis` (0=X, 1=Y, 2=Z), `UpAxisSign` (+1/-1), `FrontAxis`, `FrontAxisSign`, `CoordAxis`, `CoordAxisSign`. Build a 3×3 rotation matrix mapping FBX native axes to Y-up right-handed canonical. Apply as an additional root transform by pre-multiplying `scene.rootNode.transformation`. Do **not** bake into individual meshes — keep it at the root.
**Rationale**: Baking into each mesh vertex would prevent consumers from knowing the original transform was synthetic. A root-node transform is reversible and matches assimp's approach.

### D7 — FBX skinning accumulation
**Decision**: Build a `Map<vertexId, {boneIdx: number, weight: number}[]>` scratch table while iterating Cluster deformers. After all Clusters are processed, normalize weights per-vertex (same D1 rule). Emit one `AiBone` per Cluster with the normalized `AiVertexWeight[]`.
**Rationale**: FBX splits skinning data by bone (each Cluster owns its vertex list), while `AiBone` in the IR also owns its vertex list — the mapping is 1:1. Normalization happens once at assembly time.

### D8 — FBX BlendShape delta expansion
**Decision**: PMX-style: `AiAnimMesh.vertices[i] = baseVertex[i] + delta` for all `i` in `Shape.Indexes`. For vertices not in `Indexes`, `AiAnimMesh.vertices[i] = baseVertex[i]` (identity). This expands sparse deltas to dense arrays matching the mesh vertex count.
**Rationale**: AiAnimMesh requires dense parallel arrays matching the parent mesh vertex count. Sparse storage would require consumers to understand the sparse format, breaking the abstraction boundary.

### D9 — VMD interpolation passthrough
**Decision**: Parse the 64-byte interpolation block of each `VmdBoneFrame` into `VmdInterpolation[]` — four `{ ax, ay, bx, by }` entries for X, Y, Z, R axes (each value 0–127). Map them onto `AiVectorKey.interpolation` and `AiQuatKey.interpolation` as `{ vmd: VmdInterpolation[] }`. On VMD export, serialize back verbatim.
**Rationale**: VMD uses quadratic Bezier curves parameterized in 0–127 integer space. Converting to/from generic cubic-spline coefficients would lose precision. A passthrough approach keeps the data lossless.

### D10 — PMX physics round-trip via metadata JSON
**Decision**: On import, serialize each `PmxRigidBody` / `PmxJoint` to a JSON string and store as one `AiMetadataEntry` per body/joint under `scene.metadata["mmd:rigidBodies"]` = `{ type: AiMetadataType.AISTRING, data: JSON.stringify(rigidBodies[]) }`. On export, `JSON.parse` that string and write the binary blocks.
**Rationale**: Rigid body physics data has no IR equivalent in assimp. JSON metadata is human-readable and requires no schema changes. The JSON structure mirrors the `PmxRigidBody` TypeScript interface exactly.

### D11 — FBX embedded texture extraction
**Decision**: Parse `Video` nodes that have a `Content` property (binary type). The binary blob is the embedded file data. Create one `AiTexture` per Video node with `filename = RelativeFilename`, `height = 0` (compressed), `width = blob.byteLength`, `formatHint` derived from the filename extension. Store in `scene.textures[]`. Material texture references that match a Video node's filename are resolved to `"*N"` (embedded texture index) in the material property `"$tex.file"`.
**Rationale**: Mirrors assimp's embedded texture resolution. The `"*N"` prefix is the assimp convention for embedded textures and is already baked into the `nexus-core` AiTexture spec.

### D12 — BinaryWriter helper for nexus-mmd
**Decision**: Add `src/BinaryWriter.ts` to `nexus-mmd` with a growable `ArrayBuffer` (doubles capacity on overflow), cursor-advancing `writeUint8/16/32`, `writeInt8/16/32`, `writeFloat32`, `writeFloat64`, `writeString(s, encoding, fixedLen?)` methods. Mirrors the existing `BinaryReader.ts` API.
**Rationale**: `MMDPmxExporter` and `MMDVmdExporter` currently use manual `DataView` offset arithmetic which does not support variable-length writes. A writer abstraction makes morph/physics block serialization maintainable.

---

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| BDEF4 weight normalization changes deformation vs original tool output | Document the normalization in ImportWarning if `sum` deviates > 0.01 from 1.0 |
| FBX RotationOrder property absent on older files | Default to EulerXYZ (index 0); emit ImportWarning if unknown order encountered |
| VMD interpolation data is opaque bytes in some exporters (all zeros) | Accept zeros; emit no warning — interpolation passthrough is always lossless |
| Dense AiAnimMesh expansion of BlendShapes is memory-heavy for high-poly meshes | Emit ImportWarning with vertex count; no mitigation — sparse storage would break AiAnimMesh contract |
| PMX physics JSON may exceed AiMetadata string size limit | JSON.stringify produces < 1 MB for typical 100-body models; no practical limit in TS |
| FBX unit conversion changes coordinate scale without consumer awareness | Write `scene.metadata["nexus:unitScaleFactor"]` with the applied factor so consumers can reverse it |

---

## File-Level Change Map

### packages/nexus-mmd/src/

| File | Change Type | Notes |
|---|---|---|
| `BinaryWriter.ts` | **NEW** | Growable ArrayBuffer writer mirroring BinaryReader API |
| `MMDPmxParser.ts` | **EXTEND** | Add QDEF skinning type; fix SDEF c/r0/r1 parsing already partial |
| `MMDImporter.ts` | **MAJOR REWRITE** | Full BDEF1/2/4/SDEF skinning; all morph types; physics metadata |
| `MMDPmxExporter.ts` | **MAJOR REWRITE** | Multi-mesh; full material; skinning; morphs; physics |
| `MMDVmdParser.ts` | **EXTEND** | Expose VmdInterpolation struct from raw bytes |
| `MMDVmdExporter.ts` | **EXTEND** | Camera/light/shadow/IK frames; bezier interpolation |

### packages/nexus-fbx/src/

| File | Change Type | Notes |
|---|---|---|
| `FBXDocument.ts` | **EXTEND** | Add Skin, Cluster, BlendShape, BlendShapeChannel, Video subtypes |
| `FBXConverter.ts` | **MAJOR REWRITE** | Skinning, animation, BlendShape, coord system, material, multi-UV, textures |
| `FBXExporter.ts` | **MAJOR REWRITE** | Multi-mesh, deformers, animation, BlendShape, material Properties70, Video nodes |
| `FBXExportNode.ts` | **EXTEND** | Helpers for Deformer, AnimationStack, AnimationCurve node templates |

### packages/nexus-core/src/types/

| File | Change Type | Notes |
|---|---|---|
| `mesh.ts` | **MINOR** | Document `AiBone.ikChain` carries SDEF payload `{ type:"sdef", c, r0, r1 }` |

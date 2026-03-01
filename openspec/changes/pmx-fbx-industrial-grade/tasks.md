## 1. Infrastructure & Shared Utilities

- [x] 1.1 Create `packages/nexus-mmd/src/BinaryWriter.ts` — growable `ArrayBuffer` writer with advancing cursor; methods: `writeUint8/16/32`, `writeInt8/16/32`, `writeFloat32`, `writeFloat64`, `writeString(s, encoding, fixedLen?)`, `writeBytes(src: Uint8Array)`, `toArrayBuffer(): ArrayBuffer`
- [x] 1.2 Add `SdefCoeffs` interface to `packages/nexus-core/src/types/mesh.ts` — `{ type: "sdef"; c: AiVector3D; r0: AiVector3D; r1: AiVector3D }` — and document `AiBone.ikChain` as carrying this payload for SDEF vertices
- [x] 1.3 Add `VmdInterpolation` interface to `packages/nexus-mmd/src/MMDVmdParser.ts` — `{ ax: number; ay: number; bx: number; by: number }` — and export it
- [x] 1.4 Add helper `buildAxisSwapMatrix(upAxis, upSign, frontAxis, frontSign, coordAxis, coordSign): AiMatrix4x4` in `packages/nexus-fbx/src/FBXConverter.ts`
- [x] 1.5 Add `FBX_TICKS_PER_SECOND = 46186158000n` constant to `packages/nexus-fbx/src/FBXTokenizer.ts` (or a new `FBXConstants.ts`)

## 2. PMX Multi-Weight Skinning (Importer)

- [ ] 2.1 In `MMDImporter.ts`: replace hardcoded single-bone weight logic with a per-vertex accumulator `Map<vertexId, {boneIdx, weight}[]>`
- [ ] 2.2 Handle BDEF2: extract `boneIndex1`, `boneIndex2`, `bone1Weight`; add two entries to accumulator with weights `w` and `1-w`
- [ ] 2.3 Handle BDEF4: extract four `boneIndex`/`weight` pairs; add all non-zero entries to accumulator
- [ ] 2.4 Handle SDEF: treat like BDEF2 for weights; additionally set `AiBone.ikChain = { type:"sdef", c, r0, r1 }` on the primary bone; emit `ImportWarning "PMX_WEIGHT_UNNORMALIZED"` if `|sum - 1.0| > 0.01`
- [ ] 2.5 Handle QDEF (PMX 2.1): treat identically to BDEF4 logic
- [ ] 2.6 After accumulation, normalize per-vertex weights (sum → 1.0, drop entries with weight < 1e-6)
- [ ] 2.7 Write normalized entries to `AiBone.weights[]` for each bone; assemble `mesh.bones[]`
- [ ] 2.8 Write unit test `packages/nexus-mmd/src/__tests__/skinning.test.ts` — BDEF2 split (0.7/0.3), BDEF4 normalization, SDEF ikChain preservation

## 3. PMX Multi-Weight Skinning (Exporter)

- [ ] 3.1 In `MMDPmxExporter.ts`: build reverse lookup `Map<vertexId, {boneIdx, weight}[]>` from `mesh.bones[].weights`
- [ ] 3.2 For each vertex: count non-zero weight entries; select skinning type (1→BDEF1, 2→BDEF2/SDEF, 3-4→BDEF4) based on entry count and SDEF marker
- [ ] 3.3 Write BDEF1 block: 1 bone index via `BinaryWriter`
- [ ] 3.4 Write BDEF2 block: 2 bone indices + float32 weight
- [ ] 3.5 Write SDEF block: 2 bone indices + float32 weight + `c`/`r0`/`r1` vectors from `ikChain`; fall back to BDEF2 if `ikChain` absent
- [ ] 3.6 Write BDEF4 block: 4 bone indices + 4 float32 weights (pad with 0-index/0-weight if fewer than 4 entries)

## 4. PMX Morph Pipeline (Importer)

- [ ] 4.1 In `MMDImporter.ts`: add `buildMorphTargets(pmxDoc, baseMesh): AiAnimMesh[]` helper
- [ ] 4.2 Vertex morphs (type 1): for each morph, create `AiAnimMesh` with `vertices[]` = base + delta for all morph offsets; fill remaining vertices with base positions; set `name` = morph EN name (or JP if EN empty)
- [ ] 4.3 UV morphs (type 3): create `AiAnimMesh` with `name = "UV:" + name`; store UV offsets in `textureCoords[0]`; set all other channels to base values
- [ ] 4.4 Bone morphs (type 2): serialize to JSON `{ name, entries:[{boneIndex, translation, rotation}] }`; accumulate in array
- [ ] 4.5 Material morphs (type 8): serialize to JSON `{ name, entries:[{materialIndex, operation, diffuse, specular, ambient, edge, edgeSize, texture, sphereTexture, toon}] }`; accumulate
- [ ] 4.6 Group morphs (type 0): serialize to JSON `{ name, entries:[{morphIndex, weight}] }`; accumulate
- [ ] 4.7 Store bone/material/group morph JSON arrays in `scene.metadata["mmd:boneMorphs"]`, `"mmd:materialMorphs"`, `"mmd:groupMorphs"]` as `AiMetadataType.AISTRING`
- [ ] 4.8 Write unit test: import a PMX fixture with vertex + UV morphs; assert `morphTargets.length`, `morphTargets[0].vertices[42]` delta applied, `morphTargets[1].name` starts with `"UV:"`

## 5. PMX Morph Pipeline (Exporter)

- [ ] 5.1 In `MMDPmxExporter.ts`: add `writeMorphs(writer, scene, mesh, baseVertices)` function
- [ ] 5.2 Write vertex morph blocks: for each `AiAnimMesh` without `"UV:"` prefix, compute delta = `animMesh.vertices[i] - baseVertices[i]`; collect non-zero deltas; write PMX morph header (name JP/EN, panel, type=1) + offset count + `{vertexIndex, offsetXYZ}` entries
- [ ] 5.3 Write UV morph blocks: for each `AiAnimMesh` with `"UV:"` prefix, write morph type=3 + offset entries from `textureCoords[0]`
- [ ] 5.4 Write bone morph blocks: parse `scene.metadata["mmd:boneMorphs"]`; write type=2 morph entries
- [ ] 5.5 Write material morph blocks: parse `scene.metadata["mmd:materialMorphs"]`; write type=8 morph entries
- [ ] 5.6 Write group morph blocks: parse `scene.metadata["mmd:groupMorphs"]`; write type=0 morph entries
- [ ] 5.7 Write morph count header before all morph blocks; use `BinaryWriter` throughout
- [ ] 5.8 Write roundtrip test: PMX import → export → re-import; assert morph count equals original

## 6. PMX Physics Export

- [ ] 6.1 In `MMDPmxExporter.ts`: add `writeRigidBodies(writer, scene)` function
- [ ] 6.2 Parse `scene.metadata["mmd:rigidBodies"]`; if absent or invalid JSON, write `uint32 = 0` and return
- [ ] 6.3 For each rigid body entry: write name JP (20 bytes, UTF-16LE) + name EN (20 bytes) + associated bone index + group index + non-collision mask + shape (1 byte) + size (float32×3) + position (float32×3) + rotation (float32×3) + mass + translate damping + rotate damping + repulsion + friction + physics mode (1 byte)
- [ ] 6.4 Add `writeJoints(writer, scene)` function; parse `scene.metadata["mmd:joints"]`; write PMX joint struct per entry (name JP/EN + type + bodyA/B indices + position/rotation + limit min/max ×2 + spring factors ×2)
- [ ] 6.5 Write unit test: import a PMX with 5 rigid bodies + 4 joints → export → re-import → assert counts match

## 7. PMX Multi-Mesh Export & Full Material Properties

- [ ] 7.1 Refactor `MMDPmxExporter.ts` to iterate `scene.meshes[]`; concatenate vertex arrays with running offset; concatenate face index arrays with per-mesh vertex base offset
- [ ] 7.2 Build deduplicated texture path list from all `"$tex.file"` material properties; write PMX texture section
- [ ] 7.3 For each mesh, write one PMX material block: read `$clr.diffuse`, `$clr.specular`, `$clr.ambient`, `mmd:edgeColor`, `mmd:edgeSize`, `mmd:sphereMode`, `mmd:toonIndex` from `AiMaterial`; write default safe values for absent keys; resolve texture index from deduplicated list
- [ ] 7.4 Write unit test: export a 2-mesh scene; assert PMX vertex count = sum, material count = 2, texture section deduplicated

## 8. VMD Bezier Interpolation Round-Trip

- [ ] 8.1 In `MMDVmdParser.ts`: replace raw `interpolation: Uint8Array` with `{ x: VmdInterpolation; y: VmdInterpolation; z: VmdInterpolation; r: VmdInterpolation }` using VMD interleaved byte layout `[ax0,ax1,...,ay0,...,bx0,...,by0,...]` → map to 4-axis structs
- [ ] 8.2 In `MMDImporter.ts` VMD merge path: attach `{ vmd: [xInterp, yInterp, zInterp, rInterp] }` to each `AiVectorKey.interpolation` and `AiQuatKey.interpolation`
- [ ] 8.3 In `MMDVmdExporter.ts`: read `key.interpolation?.vmd`; if present, serialize back to 64-byte interleaved layout; if absent, write default linear preset (ax=ay=20, bx=by=107) for all 4 axes
- [ ] 8.4 Write unit test: parse VMD bone frame → export → re-parse → assert 64 interpolation bytes are byte-identical to input

## 9. VMD Camera / Light / IK Frame Export

- [ ] 9.1 In `MMDVmdParser.ts`: parse camera frames into `VmdCameraFrame[]` with `frame`, `distance`, `position[3]`, `rotation[3]`, `fov`, `perspective`; store in `VmdDocument.cameraFrames`
- [ ] 9.2 In `MMDImporter.ts`: serialize `VmdDocument.cameraFrames` to JSON; store as `scene.metadata["mmd:cameraFrames"]`; also serialize `VmdDocument.ikFrames` to `"mmd:ikFrames"`
- [ ] 9.3 In `MMDVmdExporter.ts`: parse `scene.metadata["mmd:cameraFrames"]`; write camera section header (count) + each entry with correct binary layout
- [ ] 9.4 In `MMDVmdExporter.ts`: parse `scene.metadata["mmd:ikFrames"]`; write IK frame section header + each entry (frame, show, ikCount, per-IK name[20] + enable byte)
- [ ] 9.5 Write unit test: VMD with 3 camera frames → import → export → re-import → assert camera frame count matches

## 10. FBX Skinning Extraction

- [ ] 10.1 In `FBXDocument.ts`: add `FbxSkin` and `FbxCluster` subtype classes; `FbxSkin` exposes `clusters: FbxCluster[]`; `FbxCluster` exposes `indexes: Int32Array`, `weights: Float64Array`, `transformMatrix: Float64Array` (16 values), `linkedModel: FbxModel | null`
- [ ] 10.2 In `FBXConverter.ts`: after building `AiMesh`, query child connections for Skin deformers; for each Cluster: read `Indexes`/`Weights` arrays; accumulate per-vertex weight table `Map<vertexId, {boneIdx,weight}[]>`
- [ ] 10.3 After all Clusters processed: normalize per-vertex weights (same rule as PMX D1); build `AiBone[]` — one per Cluster; set `AiBone.offsetMatrix` from `TransformMatrix` (cast float64→float32); set `AiBone.name` from linked Model name
- [ ] 10.4 Assign `mesh.bones = bones`
- [ ] 10.5 In `FBXExporter.ts`: for each mesh with `bones.length > 0`, emit `Deformer:Skin` + one `Deformer:Cluster` per bone with `Indexes`, `Weights`, `TransformMatrix` arrays; add OO Connections (Cluster→Skin, Skin→Geometry)
- [ ] 10.6 Write unit test: parse FBX fixture with skinning → assert `mesh.bones.length > 0` and first bone has `weights.length > 0`

## 11. FBX Animation Extraction

- [ ] 11.1 In `FBXDocument.ts`: add `FbxAnimationStack`, `FbxAnimationLayer`, `FbxAnimationCurveNode`, `FbxAnimationCurve` subtypes; `FbxAnimationCurve` exposes `keyTimes: BigInt64Array`, `keyValues: Float32Array`
- [ ] 11.2 In `FBXConverter.ts`: add `convertAnimations(doc): AiAnimation[]` method; iterate AnimationStack objects; for each Stack → Layer → CurveNode chain
- [ ] 11.3 For each CurveNode: determine T/R/S type from name suffix; resolve connected Model; read d|X, d|Y, d|Z child curves; build time-merged keyframe list; convert BigInt ticks → seconds
- [ ] 11.4 For rotation CurveNodes: read `RotationOrder` from Model Properties70 (default 0 = EulerXYZ); convert Euler degree triplets to `AiQuaternion` per keyframe using ZYX extrinsic composition
- [ ] 11.5 Build `AiNodeAnim` per Model per Stack; set `positionKeys`, `rotationKeys`, `scalingKeys`; set `animation.duration = (LocalStop - LocalStart) / FBX_TICKS_PER_SECOND`
- [ ] 11.6 In `FBXExporter.ts`: add `writeAnimations(animations, nodeIdMap)` function; for each `AiAnimation` emit `AnimationStack` + `AnimationLayer`; for each `AiNodeAnim` emit T/R/S `AnimationCurveNode` triplets with child `AnimationCurve` nodes; convert quaternion → Euler ZYX for rotation curves; write ticks from seconds
- [ ] 11.7 Write unit test: parse FBX fixture with one animation → assert `animations.length === 1`, `animations[0].channels.length > 0`, `positionKeys[0].time ≈ expected`

## 12. FBX BlendShape Extraction

- [ ] 12.1 In `FBXDocument.ts`: add `FbxBlendShape` and `FbxBlendShapeChannel` subtypes; `FbxBlendShapeChannel` resolves its connected `Shape` (FbxGeometry with type `"Shape"`) which exposes `shapeIndexes: Int32Array` and `shapeVertices: Float64Array`
- [ ] 12.2 In `FBXConverter.ts`: after building `AiMesh` base, query BlendShape deformers; for each BlendShapeChannel → Shape: expand sparse `Indexes`/`Vertices` deltas into dense `AiAnimMesh` (base + delta); set `animMesh.name = channelName`
- [ ] 12.3 Assign `mesh.morphTargets = animMeshes`
- [ ] 12.4 In `FBXExporter.ts`: for each mesh with `morphTargets.length > 0`, emit `Deformer:BlendShape` + one `Deformer:BlendShapeChannel` + one `Geometry:Shape` per morph target; Shape `Indexes` = indices where `|animMesh.vertices[i] - base[i]| > ε`; `Vertices` = the delta values; add OO Connections
- [ ] 12.5 Write unit test: FBX fixture with 2 BlendShape channels → `mesh.morphTargets.length === 2`, `morphTargets[0].vertices.length === mesh.vertices.length`

## 13. FBX Coordinate System & Unit Normalization

- [ ] 13.1 In `FBXConverter.ts`: add `parseGlobalSettings(doc): CoordSystemInfo` — reads `UpAxis`, `UpAxisSign`, `FrontAxis`, `FrontAxisSign`, `CoordAxis`, `CoordAxisSign`, `UnitScaleFactor` from the `GlobalSettings` PropertyTable; defaults: UpAxis=1, UpSign=1, FrontAxis=2, FrontSign=1, CoordAxis=0, CoordSign=1, Scale=1.0
- [ ] 13.2 Implement `buildAxisSwapMatrix(info): AiMatrix4x4` — maps (CoordAxis→X, UpAxis→Y, FrontAxis→Z) with sign-flip columns; combine with scale matrix from `UnitScaleFactor / 100`
- [ ] 13.3 Pre-multiply axis-swap matrix into `scene.rootNode.transformation`; store applied scale factor as `scene.metadata["nexus:unitScaleFactor"] = { type: FLOAT, data: factor }`
- [ ] 13.4 In `FBXExporter.ts`: write `GlobalSettings` block with canonical Y-up right-handed properties and `UnitScaleFactor = 1.0`
- [ ] 13.5 Write unit test: Z-up FBX (UpAxis=2) → assert root transform has ≈−90° X rotation; Y-up FBX → assert root transform is identity

## 14. FBX Full Material, Texture & Multi-UV

- [ ] 14.1 In `FBXConverter.ts`: replace single-property material extraction with `convertMaterial(matObj): AiMaterial` — iterate all `Properties70` entries; map FBX property names to assimp keys per the spec table; handle `TransparencyFactor → opacity = 1 - value`; handle PBR props (`Maya|roughness`, `Metalness`)
- [ ] 14.2 Resolve Texture child connections per material; for each Texture, read `RelativeFilename`; determine `AiTextureType` from connection property string; add `"$tex.file"` AiMaterialProperty with appropriate semantic
- [ ] 14.3 Add `FbxVideo` subtype to `FBXDocument.ts`; expose `content: ArrayBuffer | null` from `Content` binary property and `relativeFilename: string`
- [ ] 14.4 In `FBXConverter.ts`: collect all FbxVideo nodes with non-null content; create `AiTexture` entries in `scene.textures[]`; build `Map<filename, "*N">` for resolving material texture references
- [ ] 14.5 Expand `convertGeometry` to loop `LayerElementUV` indices 0–7; expand each UV layer (respecting `MappingInformationType` + `ReferenceInformationType`) into a per-vertex `AiVector3D[]`; assign to `mesh.textureCoords[N]`
- [ ] 14.6 In `FBXExporter.ts`: write per-material `Properties70` block from `AiMaterial.properties` (reverse key mapping); write `Video` node per `AiTexture`; resolve `"*N"` texture refs back to Video filename in material Texture nodes
- [ ] 14.7 Write unit test: FBX fixture with diffuse+normal textures → `material.properties` contains both `$clr.diffuse` and `"$tex.file"` for NORMALS semantic

## 15. FBX Multi-Mesh Export

- [ ] 15.1 Refactor `FBXExporter.ts` `write()` method to iterate `scene.meshes[]` instead of accessing only `[0]`
- [ ] 15.2 Assign unique sequential IDs (base: 100001) to each Geometry/Model/Material node; build `nodeIdMap: Map<meshIndex|materialIndex, id>`
- [ ] 15.3 Emit one `Geometry` node per mesh (vertices, indices, normals, UVs)
- [ ] 15.4 Emit one `Model` node per mesh; use `mesh.name || "Mesh_N"` as model name
- [ ] 15.5 Deduplicate materials: if multiple meshes share `materialIndex`, emit Material node once and reuse ID
- [ ] 15.6 In `Connections` section: write `C: "OO", modelId, geometryId` + `C: "OO", materialId, modelId` + `C: "OO", modelId, rootModelId` per mesh
- [ ] 15.7 Write unit test: export 3-mesh scene → count `Geometry:` occurrences = 3, `Model:` occurrences = 4 (3 mesh + 1 root), `Material:` = unique material count

## 16. Integration Tests & Validation

- [ ] 16.1 Add real-world PMX fixture (`packages/nexus-mmd/fixtures/model.pmx`) — a publicly available MMD model with skeleton, morphs, and physics; add expected bone count, morph count, vertex count as test constants
- [ ] 16.2 Add real-world FBX fixture (`packages/nexus-fbx/fixtures/character.fbx`) — an ASCII FBX 7.4 file with skeleton, animation, and BlendShapes; add expected constants
- [ ] 16.3 Write `packages/nexus-mmd/src/__tests__/integration.test.ts` — parse real PMX; assert: `mesh.bones.length === EXPECTED_BONES`, `mesh.morphTargets.length === EXPECTED_MORPHS`, at least one morph has `vertices[i] ≠ baseVertex[i]`, rigid body metadata present
- [ ] 16.4 Write `packages/nexus-fbx/src/__tests__/integration.test.ts` — parse real FBX; assert: `mesh.bones.length > 0`, `animations.length > 0`, `animations[0].channels.length > 0`, coordinate system normalization applied (root transform ≠ identity for Z-up source)
- [ ] 16.5 Write `packages/nexus-mmd/src/__tests__/roundtrip-full.test.ts` — full PMX round-trip with skinning + morphs + physics: import → export → re-import; assert vertex count, bone count, morph count, rigid body count all match
- [ ] 16.6 Write `packages/nexus-fbx/src/__tests__/roundtrip-full.test.ts` — full FBX round-trip with skinning + animation: import → export → re-parse; assert mesh count, bone count, animation channel count, keyframe count match
- [ ] 16.7 Run `pnpm --filter nexus-mmd vitest run` — all tests pass (including new integration tests)
- [ ] 16.8 Run `pnpm --filter nexus-fbx vitest run` — all tests pass
- [ ] 16.9 Run `pnpm --filter nexus-converter vitest run` — cross-format smoke test PMX→FBX and FBX→OBJ pass (mesh vertex count non-zero, no unhandled exceptions)

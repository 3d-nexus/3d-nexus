## Why

The `nexus-mmd` and `nexus-fbx` packages ship working tokenizers and parsers, but a code audit reveals that the importers/exporters are stub-grade: multi-weight skeletal skinning is hardcoded to a single bone, morph targets are parsed but never applied, FBX animations and deformers are entirely skipped, and exporters silently drop all meshes beyond the first. A library that discards rigging, animation, and blend shapes cannot be used in any real production pipeline. This change upgrades both packages to full industrial coverage.

## What Changes

- **New**: PMX multi-weight skinning importer — BDEF1/2/4 weights properly normalized and mapped to `AiBone.weights[]`; SDEF dual-quaternion coefficients (c/r0/r1) preserved via `AiBone.ikChain`; QDEF (PMX 2.1) handled.
- **New**: PMX multi-weight skinning exporter — reconstructs BDEF1/2/4/SDEF vertex skinning blocks from IR when writing PMX binary.
- **New**: PMX complete morph pipeline — vertex morphs applied as absolute delta positions in `AiAnimMesh`; UV, bone, material, and group morphs parsed and stored; all morph types exported back to PMX.
- **New**: PMX physics export — rigid bodies and joints read from `scene.metadata["mmd:rigidBodies"]` / `"mmd:joints"` and written as PMX RigidBody + Joint binary blocks.
- **New**: PMX multi-mesh exporter — merges `scene.meshes[]` into a single PMX vertex/index stream with per-material sections; full material property round-trip (diffuse/specular/ambient/edge/toon/sphere texture).
- **New**: VMD Bezier interpolation round-trip — per-axis (X/Y/Z/R) bezier control points read from the 64-byte interpolation block, stored in `AiVectorKey/AiQuatKey.interpolation`, and written back verbatim on export.
- **New**: VMD camera, light, shadow, and IK-enable frame export — currently written as empty stubs; now fully serialized.
- **New**: FBX skeletal skinning extraction — Skin + Cluster deformer graph traversed; `IndexArray`/`WeightArray`/`TransformMatrix` per Cluster accumulated into `AiMesh.bones[]`; exporter writes Deformer:Skin + Deformer:Cluster nodes.
- **New**: FBX animation extraction — `AnimationStack → Layer → CurveNode (T/R/S) → Curve` graph traversed; FBX ticks converted to seconds; Euler-to-quaternion conversion (ZYX order); `AiAnimation` + `AiNodeAnim` populated; exporter writes full animation graph.
- **New**: FBX BlendShape morph extraction — `BlendShape → BlendShapeChannel → Shape` connections resolved; sparse `Indexes`/`Vertices` deltas expanded into `AiAnimMesh`; exporter writes deformer nodes.
- **New**: FBX coordinate system + unit normalization — `GlobalSettings` `UpAxis`/`FrontAxis`/`CoordAxis` + sign fields decoded into a 4×4 axis-swap matrix applied to the root node; `UnitScaleFactor` applied; exporter writes canonical `GlobalSettings`.
- **New**: FBX full material + embedded texture extraction — all `Properties70` material entries parsed (diffuse, specular, ambient, emissive, normal map, roughness, metallic, opacity); `Video` nodes with `Content` binary data extracted as `AiTexture`; `LayerElementUV[0..7]` mapped to `textureCoords[0..7]`; exporter writes `Video` + material `Properties70`.
- **New**: FBX multi-mesh exporter — each `AiMesh` gets its own `Geometry` + `Model` node; `Connections` block correctly links Model→Geometry, Model→Material, Model→Deformer; all models parented to root.

## Capabilities

### New Capabilities

- `pmx-skinning`: Full BDEF1/2/4 + SDEF + QDEF skinning import and export with weight normalization
- `pmx-morphs`: Complete morph pipeline — vertex/UV/bone/material/group morphs import and export
- `pmx-physics-export`: PMX rigid body and joint metadata round-trip to binary output
- `pmx-multi-mesh-export`: Multi-mesh PMX export with full material property and texture index support
- `vmd-interpolation`: VMD Bezier interpolation round-trip; camera/light/shadow/IK frame export
- `fbx-skinning`: FBX Skin+Cluster deformer extraction and export
- `fbx-animation`: FBX AnimationStack/Curve extraction and export (with tick↔second conversion)
- `fbx-blendshape`: FBX BlendShape morph extraction and export
- `fbx-coordinate-system`: GlobalSettings axis-swap + UnitScaleFactor normalization
- `fbx-textures-materials`: Full FBX material Properties70 + embedded Video texture + multi-UV extraction and export
- `fbx-multi-mesh-export`: FBX multi-mesh Geometry/Model/Connections export

### Modified Capabilities

## Impact

- **`packages/nexus-mmd`**: `MMDImporter.ts`, `MMDPmxExporter.ts`, `MMDVmdExporter.ts`, `MMDVmdParser.ts` — all significantly extended; `BinaryWriter.ts` added as new binary output helper.
- **`packages/nexus-fbx`**: `FBXConverter.ts`, `FBXExporter.ts`, `FBXDocument.ts` — major extensions; `FBXExportNode.ts` / `FBXExportProperty.ts` enhanced for deformer/animation nodes.
- **`packages/nexus-core`**: `AiBone.ikChain` typing tightened to carry SDEF metadata; no breaking interface changes.
- **No new runtime dependencies**: all changes use existing `fflate`, `DataView`, `TextDecoder` primitives already in the build.
- **Test fixtures**: real-world `.pmx` and `.fbx` fixtures with known bone/morph/animation counts added under `packages/nexus-mmd/fixtures/` and `packages/nexus-fbx/fixtures/`.

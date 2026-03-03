# Compatibility Matrix Summary

| Capability | Profiles Covered | Tested Tool Versions | Known Gaps |
|---|---|---|---|
| `fbx-transform-fidelity` | `blender-fbx`, `maya-fbx`, `3dsmax-fbx` | Blender fixture set, Maya pivot fixture set, 3ds Max negative-scale fixture set | Full DCC procedural constraints are still metadata-backed rather than fully evaluated |
| `fbx-scene-extras` | `maya-fbx`, `motionbuilder-fbx` | Maya/MotionBuilder-style camera, light, user-property fixtures | Unsupported constraint families are diagnosed instead of reconstructed |
| `fbx-animation` | `blender-fbx`, `maya-fbx`, `motionbuilder-fbx` | Layered animation fixtures and camera/light channel tests | Deep resampling policies remain profile-driven, not DCC-plugin identical |
| `fbx-skinning` | `maya-fbx`, `unity`, `unreal` | Skin cluster, DQ hint, blendshape regression fixtures | Runtime targets still degrade DQ-specific semantics |
| `fbx-textures-materials` | `blender-fbx`, `maya-fbx`, `unity`, `unreal` | Layered texture, multi-UV, Unicode media-path fixtures | Legacy/PBR shading conversion is diagnostic-backed when exact parity is impossible |
| `pmx-skinning` | `mmd` | Synthetic PMX SDEF/QDEF round-trip regression tests | Non-PMX targets degrade QDEF semantics and report the fallback |
| `pmx-morphs` | `mmd` plus cross-format report paths | PMX extended UV, flip, impulse morph regression tests | FBX/runtime targets report degraded PMX-only morph semantics |
| `pmx-physics-export` | `mmd` plus cross-format report paths | PMX rigid body, joint, soft-body-compatible regression tests | Soft-body blocks stay metadata-backed outside PMX round-trip |
| `vmd-interpolation` | `mmd`, `motionbuilder-fbx` report path | Bone interpolation byte-roundtrip, morph/camera/light frame tests | Off-frame editing paths are diagnosed as drift instead of silently resampled |
| `bvh-skeleton-motion` | `bvh` plus BVH cross-format report paths | Canonical BVH basic skeleton, root motion, FBX roundtrip smoke tests | FBX and VMD bridges normalize hierarchy/channel layout; PMX paths degrade BVH-only structure |
| `bvh-animation-fidelity` | `bvh` plus BVH cross-format report paths | Frame-time roundtrip, rotation-order preservation, frame-drift diagnostics tests | Off-frame edits degrade timing fidelity and FBX/VMD bridges normalize frame semantics |
| `bvh-conversion-workflow` | `bvh` | Converter report tests, playground BVH loading path, manual browser validation guide | Browser flow is validated with canonical fixtures, not external DCC-authored BVH corpora |

## Current Validation Scope

| Area | Status |
|---|---|
| PMX round-trip regression suite | Active in `packages/nexus-mmd` |
| FBX profile regression suite | Active in `packages/nexus-fbx` |
| Converter compatibility reports | Active in `packages/nexus-converter` |
| Playground compatibility visualization | Active in `apps/playground` |
| BVH parser/exporter/fidelity regression suite | Active in `packages/nexus-bvh` |

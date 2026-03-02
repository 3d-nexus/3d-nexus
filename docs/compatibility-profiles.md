# Compatibility Profiles

| Profile | Primary Target | Exact | Normalized | Degraded |
|---|---|---|---|---|
| `mmd` | PMX/VMD round-trip | PMX structural, skinning, morph, VMD frame data round-trip without authored loss | Frame-based data stays aligned but may be re-ordered into normalized IR containers | Any unsupported external format bridge must emit explicit diagnostics |
| `blender-fbx` | Blender-authored FBX | Transform stack, material paths, mesh topology, common animation curves | Axis/unit normalization without semantic loss | DCC-only constructs that cannot survive runtime-style export |
| `maya-fbx` | Maya-authored FBX | Pivot stack, animation layer order, camera/light authoring metadata | Coordinate normalization and property flattening that preserve authored evaluation | Constraints, layered materials, or PMX-only semantics exported out of Maya-style FBX |
| `3dsmax-fbx` | 3ds Max-authored FBX | Handedness, negative scale metadata, instancing identity | Export order normalization with preserved transform meaning | Features requiring DCC-side procedural reconstruction |
| `motionbuilder-fbx` | MotionBuilder animation exchange | Integer-frame timing and authored animation stacks | Sampling kept on-frame with stable curve identity | Cross-format timing paths that cannot preserve authored stack semantics |
| `unity` | Runtime-target FBX | Meshes, materials, skeletal animation inside runtime limits | Material fallback from DCC shading to runtime PBR/legacy equivalents | PMX-specific morph/physics semantics and DCC-only evaluation metadata |
| `unreal` | Runtime-target FBX | Meshes, skeletal animation, material bindings that map to runtime assets | Coordinate and shading normalization for import pipeline expectations | PMX-only authoring metadata and unsupported FBX extras |

## Outcome Semantics

| Outcome | Meaning |
|---|---|
| `exact` | Exported or converted data is expected to preserve authored semantics without observable drift inside the profile's tolerance window. |
| `normalized` | Data was rewritten into a canonical representation, but the authored result should remain equivalent for the target profile. |
| `degraded` | The target path keeps partial fidelity but drops or approximates authored semantics; a diagnostic is required. |
| `unsupported` | The target path cannot represent the feature and the report should fail the affected capability. |

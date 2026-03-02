## Why

The current FBX/PMX support is sufficient for baseline interchange, but it still loses authoring fidelity when assets move across industrial DCC tools such as Blender, Maya, 3ds Max, MotionBuilder, MMD, Unity, and Unreal. We need a compatibility matrix that defines which semantics must round-trip exactly, which may be normalized, and which must be preserved as metadata so the pipeline can be trusted for production assets instead of only synthetic fixtures.

## What Changes

- Define a DCC compatibility matrix with named tool profiles, canonical fixtures, and per-capability acceptance criteria.
- Add full-fidelity FBX transform handling for pivots, pre/post rotation, geometric transforms, inherit types, negative scale, and instancing.
- Add FBX scene extras coverage for cameras, lights, constraints, and user properties that participate in interchange with DCC tools.
- Expand PMX structure fidelity to cover bone flags, append/inherit transforms, local axes, display frames, toon/sphere settings, and soft-body-adjacent metadata preservation.
- Extend existing FBX/PMX animation, morph, skinning, coordinate-system, material, and physics requirements to define industrial-grade round-trip behavior and validation tolerances.
- Add cross-DCC validation and reporting so unsupported semantics are explicitly surfaced instead of silently dropped.

## Capabilities

### New Capabilities
- `dcc-compatibility-matrix`: Defines DCC profiles, fixture coverage, tolerance rules, and compatibility reporting across FBX/PMX pipelines.
- `fbx-transform-fidelity`: Covers FBX pivot stacks, geometric transforms, inherit modes, instancing, and handedness-preserving transform composition.
- `fbx-scene-extras`: Covers FBX cameras, lights, constraints, and custom properties that must survive import/export.
- `pmx-structure-fidelity`: Covers PMX bone flags, append/local-axis metadata, display frames, toon/sphere material controls, and structural metadata preservation.

### Modified Capabilities
- `fbx-animation`: Extend animation requirements to preserve rotation order, layered evaluation, camera/light channels, and interpolation semantics across DCC tools.
- `fbx-blendshape`: Extend blendshape requirements to preserve channel deform percent, in-between targets, and weight animation behavior.
- `fbx-coordinate-system`: Extend coordinate-system requirements to preserve unit metadata, handedness changes, pivot-aware conversion, and root normalization reporting.
- `fbx-skinning`: Extend skinning requirements to preserve bind poses, link modes, dual-quaternion flags, and partition constraints.
- `fbx-textures-materials`: Extend material requirements to preserve layered textures, UV set routing, texture transforms, embedded media, and legacy/PBR fallbacks.
- `pmx-morphs`: Extend PMX morph requirements to cover flip, impulse, extended UV, category/order fidelity, and display metadata.
- `pmx-physics-export`: Extend physics requirements to preserve solver metadata, per-joint flags, and soft-body-compatible metadata blocks.
- `pmx-skinning`: Extend skinning requirements to preserve SDEF/QDEF edge cases, bone dependency flags, and export-side reconstruction constraints.
- `vmd-interpolation`: Extend VMD requirements to preserve morph, camera, light, and frame-rate-sensitive interpolation semantics.

## Impact

- Affected packages: `packages/nexus-fbx`, `packages/nexus-mmd`, `packages/nexus-core`, `packages/nexus-converter`, and the browser playground validation flows.
- New fixtures, compatibility reports, and validation harnesses will be added under package-level test suites.
- Exported IR will gain additional fidelity metadata keys for unsupported native constructs that must survive round-trip.
- Some existing importer/exporter paths will need stricter warnings or explicit compatibility failures where silent lossy conversion currently occurs.

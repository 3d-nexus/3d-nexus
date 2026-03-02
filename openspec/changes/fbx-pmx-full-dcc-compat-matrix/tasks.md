## 1. Compatibility Matrix Foundation

- [x] 1.1 Define profile names, fixture manifest schema, and compatibility report schema under `openspec` and test utilities
- [x] 1.2 Add minimal canonical fixtures for MMD, Blender FBX, Maya FBX, 3ds Max FBX, MotionBuilder FBX, Unity, and Unreal validation paths
- [x] 1.3 Implement shared tolerance helpers for exact, normalized, degraded, and unsupported outcomes
- [x] 1.4 Add CI-friendly compatibility report generation for package test runs

## 2. FBX Transform Fidelity

- [x] 2.1 Preserve FBX transform stack terms on import, including pivots, offsets, pre/post rotation, inherit type, and geometric transforms
- [x] 2.2 Reconstruct FBX transform stack terms on export from preserved metadata
- [x] 2.3 Preserve instancing relationships and mirrored handedness metadata during import/export
- [x] 2.4 Add fixture-driven tests for Maya/3ds Max pivot scenes and negative-scale cases

## 3. FBX Scene Extras

- [x] 3.1 Import and export camera properties needed for DCC-grade round-trip
- [x] 3.2 Import and export light properties, including cone, intensity, color, and visibility behavior
- [x] 3.3 Preserve supported FBX constraints and custom user properties as structured metadata
- [x] 3.4 Add compatibility diagnostics and tests for unsupported scene-extra constructs

## 4. FBX Animation Fidelity

- [x] 4.1 Preserve rotation order, layer ordering, and pivot-aware evaluation metadata on animated nodes
- [x] 4.2 Extend animation import/export to include camera and light property channels
- [x] 4.3 Add profile-aware sampling/tolerance checks for Maya, Blender, and MotionBuilder animation fixtures
- [x] 4.4 Emit diagnostics when animation fallback or resampling changes authored semantics

## 5. FBX Skinning And Blendshape Fidelity

- [x] 5.1 Preserve bind pose, transform link matrices, and cluster link modes in import/export paths
- [x] 5.2 Surface dual-quaternion flags and runtime influence-limit degradations in compatibility reports
- [x] 5.3 Preserve blendshape channel full-weight values, in-between targets, and animated weight bindings
- [x] 5.4 Add regression tests for additive skinning, DQ skin hints, and in-between blendshape fixtures

## 6. FBX Materials, Media, And UV Semantics

- [x] 6.1 Preserve layered textures, UV set routing, texture transforms, wrap/filter settings, and embedded media path identity
- [x] 6.2 Expand material fallback handling between legacy and PBR shading models with explicit diagnostics
- [x] 6.3 Add fixture coverage for multi-UV, layered textures, embedded media, and Unicode path cases
- [x] 6.4 Validate deterministic export for Blender, Maya, and runtime-target material profiles

## 7. PMX Structural Fidelity

- [ ] 7.1 Preserve PMX bone flags, append/inherit settings, fixed/local axis data, and deform-layer metadata
- [ ] 7.2 Preserve display frames, member ordering, shared toon settings, sphere modes, and material-side PMX extension fields
- [ ] 7.3 Restore preserved PMX structure metadata during export with compatibility diagnostics for unsupported fields
- [ ] 7.4 Add fixture-based tests for authored display frames, local-axis bones, and append-transform chains

## 8. PMX Skinning, Morph, And Physics Expansion

- [ ] 8.1 Preserve SDEF/QDEF authoring intent and report target-profile fallbacks explicitly
- [ ] 8.2 Preserve extended UV, flip, impulse, and bilingual morph metadata needed for PMX re-export
- [ ] 8.3 Preserve rigid body, joint, and soft-body-compatible metadata blocks for industrial-grade PMX round-trip
- [ ] 8.4 Add regression tests covering impulse morphs, extended UV morphs, deform-after-physics bones, and PMX 2.1 physics extensions

## 9. VMD And Cross-Format Timing Fidelity

- [ ] 9.1 Preserve morph, camera, and light frame semantics alongside bone interpolation
- [ ] 9.2 Track original frame indices during time-based normalization and diagnose resampling drift
- [ ] 9.3 Add PMX/VMD to FBX and FBX to PMX conversion tests that verify morph/timing compatibility reports
- [ ] 9.4 Validate byte-exact VMD interpolation round-trip where no normalization occurred

## 10. Converter, Playground, And Documentation

- [ ] 10.1 Expose compatibility profile selection and report output through `nexus-converter`
- [ ] 10.2 Surface compatibility status and diagnostics in the playground validation workflow
- [ ] 10.3 Document exact vs normalized vs degraded behavior for each profile and capability
- [ ] 10.4 Publish a compatibility matrix summary that maps capabilities to tested tool versions and known gaps

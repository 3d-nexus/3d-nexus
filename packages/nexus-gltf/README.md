# @3d-nexus/gltf

glTF 2.0 importer/exporter for 3d-nexus.

Supported outputs:

- `.glb` single-file binary container
- `.gltf` JSON plus external `.bin` buffer via `GltfExporter#getBinContent()`

Supported inputs:

- `.glb`
- `.gltf` with `settings.binBuffer`
- `.gltf` with a base64 data URI buffer

Current fidelity coverage includes triangle meshes, node transforms, PBR base color / roughness / metalness, base-color and normal texture references, embedded image payloads, skin joints / weights, inverse bind matrices, morph targets, node translation / rotation / scale animations, and morph target weight animations.

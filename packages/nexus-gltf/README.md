# @3d-nexus/gltf

glTF 2.0 importer/exporter for 3d-nexus.

Supported outputs:

- `.glb` single-file binary container
- `.gltf` JSON plus external `.bin` buffer via `GltfExporter#getBinContent()`

Supported inputs:

- `.glb`
- `.gltf` with `settings.binBuffer`
- `.gltf` with a base64 data URI buffer

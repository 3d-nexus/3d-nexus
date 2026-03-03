## ADDED Requirements

### Requirement: BVH hierarchy and channel layout are parsed into IR and metadata
The system SHALL parse BVH `HIERARCHY` sections, including `ROOT`, `JOINT`, `End Site`, `OFFSET`, and per-joint `CHANNELS`, into a deterministic skeleton graph under `AiNode`. The importer SHALL preserve authored channel order and raw joint layout metadata under `bvh:*` keys so export can reconstruct the source hierarchy textually.

#### Scenario: Root joint with translation and rotation channels is preserved
- **WHEN** a BVH root defines `CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation`
- **THEN** the imported root node SHALL preserve that exact channel order in metadata and the generated animation channels SHALL map those transforms without reordering silently

#### Scenario: End Site offset survives round-trip
- **WHEN** a BVH joint contains an `End Site` block with a non-zero offset
- **THEN** the importer SHALL preserve that offset in metadata and exporter SHALL restore an equivalent `End Site` block

### Requirement: BVH exporter reconstructs stable hierarchy and motion sections
The exporter SHALL write a stable BVH document from IR skeleton and animation data, including `HIERARCHY`, `MOTION`, `Frames`, and `Frame Time`, using preserved `bvh:*` metadata when available and canonical channel ordering otherwise.

#### Scenario: Imported BVH round-trips to equivalent hierarchy text
- **WHEN** a BVH file is imported and then exported without semantic edits
- **THEN** the resulting BVH SHALL preserve joint names, hierarchy order, offsets, frame count, and channel count for each joint

#### Scenario: Canonical export is explicit when metadata is absent
- **WHEN** an IR skeleton was not originally imported from BVH and lacks channel metadata
- **THEN** exporter SHALL emit a canonical BVH channel order and compatibility reporting SHALL be able to classify the result as normalized

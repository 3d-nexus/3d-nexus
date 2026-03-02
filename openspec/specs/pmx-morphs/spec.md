# pmx-morphs Specification

## Purpose
TBD - created by archiving change pmx-fbx-industrial-grade. Update Purpose after archive.
## Requirements
### Requirement: Vertex morph targets populated in IR
The `MMDImporter` SHALL produce one `AiAnimMesh` per PMX vertex morph, stored in `AiMesh.morphTargets[]`. Each `AiAnimMesh.vertices[i]` SHALL equal the base mesh vertex position PLUS the morph offset at that index. Vertices not referenced by the morph SHALL hold the unmodified base position.

#### Scenario: Vertex morph delta applied
- **WHEN** a PMX model has a vertex morph "smile" that offsets vertex 42 by `{x:0, y:0.1, z:0}`
- **THEN** `mesh.morphTargets` SHALL contain one `AiAnimMesh` with `name="smile"` where `vertices[42]` equals `baseVertex[42] + {0, 0.1, 0}`

#### Scenario: Unaffected vertices are base positions
- **WHEN** a vertex morph affects only 10 of 1000 vertices
- **THEN** the remaining 990 entries in `AiAnimMesh.vertices` SHALL equal the corresponding base mesh positions

### Requirement: UV morph stored in AiAnimMesh
The `MMDImporter` SHALL store PMX UV morphs in `AiAnimMesh.textureCoords[0]` as UV delta values (NOT absolute UVs). The `AiAnimMesh.name` SHALL be prefixed with `"UV:"` followed by the morph name.

#### Scenario: UV morph naming convention
- **WHEN** a PMX UV morph is named "eyeWink"
- **THEN** the corresponding `AiAnimMesh.name` SHALL be `"UV:eyeWink"`

#### Scenario: UV delta values stored
- **WHEN** a PMX UV morph offsets UV[5] by `{u: 0.05, v: -0.02}`
- **THEN** `animMesh.textureCoords[0][5]` SHALL be `{x: 0.05, y: -0.02, z: 0}`

### Requirement: Bone / material / group morphs stored in scene metadata
The `MMDImporter` SHALL serialize PMX bone morphs, material morphs, and group morphs as JSON strings stored in `scene.metadata` under keys `"mmd:boneMorphs"`, `"mmd:materialMorphs"`, and `"mmd:groupMorphs"` respectively. Each entry SHALL use `AiMetadataType.AISTRING`.

#### Scenario: Bone morph metadata stored
- **WHEN** a PMX model has 3 bone morphs
- **THEN** `scene.metadata["mmd:boneMorphs"].data` SHALL be a JSON-parseable string whose parsed array has length 3

#### Scenario: Material morph metadata stored
- **WHEN** a PMX model has material morphs
- **THEN** `scene.metadata["mmd:materialMorphs"].data` SHALL contain each morph's target material index, operation (multiply/add), and color override fields

### Requirement: Morph export — vertex morphs written to PMX binary
The `MMDPmxExporter` SHALL write one PMX morph block per `AiAnimMesh` in `mesh.morphTargets` that does NOT have a `"UV:"` name prefix. The morph block SHALL contain one `PmxMorphOffset` entry per vertex where `|AiAnimMesh.vertices[i] - baseVertex[i]| > ε`.

#### Scenario: Vertex morph round-trip offset count
- **WHEN** a model with a vertex morph affecting 10 vertices is imported and re-exported
- **THEN** the exported PMX morph block SHALL contain exactly 10 offset entries

### Requirement: Morph export — UV morphs written to PMX binary
The `MMDPmxExporter` SHALL write PMX UV morph blocks for each `AiAnimMesh` with name prefixed `"UV:"`. The morph name SHALL strip the `"UV:"` prefix.

#### Scenario: UV morph name restored on export
- **WHEN** an `AiAnimMesh` named `"UV:eyeWink"` is exported
- **THEN** the PMX morph block SHALL have the name `"eyeWink"` and type `3` (UV morph)

### Requirement: Morph export — non-vertex morphs restored from metadata
The `MMDPmxExporter` SHALL read `scene.metadata["mmd:boneMorphs"]`, `"mmd:materialMorphs"`, and `"mmd:groupMorphs"`, parse each JSON string, and write the corresponding PMX morph blocks. If a metadata key is absent, the exporter SHALL skip that morph type without error.

#### Scenario: Group morph round-trip
- **WHEN** a model with 2 group morphs is imported and re-exported
- **THEN** the exported PMX morph count SHALL include 2 group-type morph blocks


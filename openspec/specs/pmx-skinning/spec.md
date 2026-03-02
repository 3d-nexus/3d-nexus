# pmx-skinning Specification

## Purpose
TBD - created by archiving change pmx-fbx-industrial-grade. Update Purpose after archive.
## Requirements
### Requirement: BDEF2 dual-bone weight import
The `MMDImporter` SHALL correctly map BDEF2 skinning data to `AiBone` entries: two bones per vertex, with `bone1Weight` stored on bone1's `AiVertexWeight` and `(1 - bone1Weight)` on bone2's `AiVertexWeight`.

#### Scenario: BDEF2 weight split
- **WHEN** a PMX vertex has BDEF2 skinning with `boneIndex1=3`, `boneIndex2=7`, `bone1Weight=0.7`
- **THEN** the importer SHALL create `AiVertexWeight { vertexId, weight: 0.7 }` on bone index 3 AND `AiVertexWeight { vertexId, weight: 0.3 }` on bone index 7

### Requirement: BDEF4 quad-bone weight import with normalization
The `MMDImporter` SHALL map BDEF4 skinning to up to four `AiBone` entries and SHALL normalize the four weights so their sum equals 1.0 if the original sum deviates from 1.0 by more than 1e-6.

#### Scenario: BDEF4 normalized weights
- **WHEN** a PMX vertex has BDEF4 with weights `[0.5, 0.5, 0.0, 0.0]`
- **THEN** only two `AiVertexWeight` entries SHALL be created (zero-weight entries omitted)

#### Scenario: BDEF4 unnormalized weights get corrected
- **WHEN** a PMX vertex has BDEF4 with raw weights `[0.4, 0.4, 0.4, 0.4]` (sum = 1.6)
- **THEN** each stored weight SHALL be `0.25` (normalized) and an `ImportWarning` with `code "PMX_WEIGHT_UNNORMALIZED"` SHALL be emitted

### Requirement: SDEF skinning coefficients preserved
The `MMDImporter` SHALL store SDEF dual-quaternion blend coefficients `c`, `r0`, `r1` in `AiBone.ikChain` as `{ type: "sdef", c: AiVector3D, r0: AiVector3D, r1: AiVector3D }`. The two SDEF bone indices and `bone1Weight` SHALL be stored as BDEF2-equivalent `AiVertexWeight` entries.

#### Scenario: SDEF bone weight mapping
- **WHEN** a PMX vertex has SDEF skinning
- **THEN** `AiBone.weights` SHALL have two entries (like BDEF2) AND `AiBone.ikChain.type` SHALL equal `"sdef"`

#### Scenario: SDEF coefficients accessible
- **WHEN** a consumer reads the exported IR for an SDEF vertex
- **THEN** `(bone.ikChain as SdefCoeffs).c` SHALL be an `AiVector3D` matching the original PMX `c` vector within float32 precision

### Requirement: QDEF skinning (PMX 2.1) import
The `MMDImporter` SHALL handle QDEF skinning type (4 bones with weights), storing it identically to BDEF4 (same weight normalization logic). QDEF is a PMX 2.1-only type.

#### Scenario: QDEF falls back to BDEF4 logic
- **WHEN** a PMX 2.1 vertex has QDEF skinning
- **THEN** the imported `AiMesh.bones` SHALL reflect the same structure as BDEF4 with normalized weights

### Requirement: PMX skinning exporter — BDEF1/2/4/SDEF reconstruction
The `MMDPmxExporter` SHALL write the correct skinning type block for each vertex based on the number of non-zero weights in the assembled bone list and the presence of an SDEF `ikChain` marker.

#### Scenario: Single-bone vertex exported as BDEF1
- **WHEN** a vertex has exactly one `AiVertexWeight` with `weight ≈ 1.0`
- **THEN** the exported PMX byte SHALL set `skinningType = 0` (BDEF1) and write one bone index

#### Scenario: Two-bone vertex exported as BDEF2
- **WHEN** a vertex has exactly two `AiVertexWeight` entries
- **THEN** the exported PMX byte SHALL set `skinningType = 1` (BDEF2)

#### Scenario: SDEF vertex preserved on export
- **WHEN** the IR bone for this vertex has `ikChain.type === "sdef"`
- **THEN** the exported PMX byte SHALL set `skinningType = 3` (SDEF) and write `c`, `r0`, `r1` vectors

#### Scenario: Four-bone vertex exported as BDEF4
- **WHEN** a vertex has three or four `AiVertexWeight` entries and no SDEF marker
- **THEN** the exported PMX byte SHALL set `skinningType = 2` (BDEF4) with weights padded to four entries summing to 1.0


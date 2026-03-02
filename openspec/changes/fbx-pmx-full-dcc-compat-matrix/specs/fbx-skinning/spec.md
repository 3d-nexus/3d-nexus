## ADDED Requirements

### Requirement: Bind pose and link mode semantics are preserved
The `FBXConverter` SHALL preserve per-cluster bind pose matrices, transform link matrices, and link modes needed to distinguish normalized, additive, and total-one skin behavior. The `FBXExporter` SHALL reconstruct those semantics when metadata is available.

#### Scenario: Additive link mode remains visible
- **WHEN** a Cluster uses additive link mode
- **THEN** the imported metadata SHALL preserve that mode and export SHALL not silently convert it to the default total-one behavior

#### Scenario: Bind pose matrices survive round-trip
- **WHEN** a skin deformer includes bind pose matrices distinct from the current node transforms
- **THEN** those matrices SHALL be preserved for export and validation

### Requirement: Dual-quaternion and partition constraints are surfaced
The system SHALL preserve skinning options that affect deformation fidelity, including dual-quaternion usage flags, deform-accuracy hints, and profile-specific partition limits such as maximum influences per runtime target.

#### Scenario: Dual-quaternion flag preserved
- **WHEN** an FBX skin deformer is authored for dual-quaternion behavior
- **THEN** the imported metadata SHALL record that choice even if the normalized IR stores only bone weights

#### Scenario: Runtime influence limit is diagnosed
- **WHEN** conversion targets a profile that supports fewer influences per vertex than the source skin
- **THEN** the compatibility report SHALL include a degradation diagnostic naming the affected profile limit

## ADDED Requirements

### Requirement: Extended PMX morph types and ordering are preserved
The `MMDImporter` SHALL preserve PMX flip morphs, impulse morphs, and extended UV morphs (UV1-UV4) together with each morph's category, panel placement, and authored display order. The `MMDPmxExporter` SHALL reconstruct those morph blocks from preserved metadata.

#### Scenario: Impulse morph metadata stored
- **WHEN** a PMX file contains an impulse morph targeting a rigid body
- **THEN** scene metadata SHALL preserve the rigid body index, local/global flag, and velocity/angular velocity values for export

#### Scenario: Extended UV morph channel survives round-trip
- **WHEN** a PMX morph targets UV3
- **THEN** the imported metadata SHALL preserve that target channel and export SHALL not collapse it into the primary UV morph type

### Requirement: Morph names and display grouping remain stable across conversion
The system SHALL keep PMX morph names, English names when present, and display-frame membership stable so cross-format conversion can report which morph semantics were preserved exactly and which were normalized.

#### Scenario: English morph name retained
- **WHEN** a PMX morph has both Japanese and English names
- **THEN** both names SHALL remain available for PMX re-export and compatibility reporting

#### Scenario: Unsupported morph type is diagnosed
- **WHEN** conversion targets a format that cannot represent impulse morphs
- **THEN** the compatibility report SHALL mark the morph capability as `degraded` and identify the dropped morph names

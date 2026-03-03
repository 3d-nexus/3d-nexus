# pmx-structure-fidelity Specification

## Purpose
Preserve PMX structural metadata such as bone flags, display frames, and material-side extension fields beyond the normalized IR.

## Requirements

### Requirement: PMX bone structure metadata is preserved beyond the normalized skeleton
The `MMDImporter` SHALL preserve PMX bone flags and structural metadata required for DCC-grade round-trip, including display destination, local axis vectors, append/inherit transform settings, fixed axis, external parent key, IK loop/limit data, and deform layer ordering. The `MMDPmxExporter` SHALL restore those fields when metadata is present.

#### Scenario: Append transform settings survive round-trip
- **WHEN** a PMX bone appends rotation from a parent with a non-default ratio
- **THEN** the imported metadata SHALL preserve the source bone index, append mode, and ratio for export

#### Scenario: Local axis vectors preserved
- **WHEN** a PMX bone defines explicit local X and Z axes
- **THEN** export SHALL restore those axis vectors instead of replacing them with inferred defaults

### Requirement: PMX display frames and material extension fields are preserved
The system SHALL preserve display frames, bone/morph membership ordering, shared toon indices, sphere texture modes, edge settings, and other material-side PMX fields that are not fully expressible by the normalized IR alone.

#### Scenario: Display frame membership remains ordered
- **WHEN** a PMX model defines a facial display frame with an explicit morph ordering
- **THEN** the imported metadata SHALL preserve the frame name and member order for export

#### Scenario: Sphere texture mode survives round-trip
- **WHEN** a material uses an additive sphere texture
- **THEN** the exported PMX SHALL restore the same sphere mode rather than dropping to "off"

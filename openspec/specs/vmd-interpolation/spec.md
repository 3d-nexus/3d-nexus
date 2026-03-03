# vmd-interpolation Specification

## Purpose
Preserve VMD frame-based interpolation, original frame indices, and timing diagnostics across round-trip and cross-format conversion.

## Requirements

### Requirement: VMD interpolation scope includes morph, camera, and light semantics
The `VmdParser`, `MMDImporter`, and `MMDVmdExporter` SHALL preserve interpolation data not only for bone transforms but also for morph frames, camera frames, and light frames where the VMD format defines interpolation or frame-stepped semantics.

#### Scenario: Camera interpolation preserved
- **WHEN** a VMD camera frame sequence uses authored interpolation bytes
- **THEN** import SHALL preserve those bytes in structured form and export SHALL reconstruct them byte-for-byte

#### Scenario: Morph frame cadence remains intact
- **WHEN** a morph animation uses sparse frame numbers at 30 fps timing
- **THEN** conversion and export SHALL preserve the original frame numbers instead of resampling them to seconds and back with drift

### Requirement: Frame-rate-sensitive normalization is reported explicitly
If a conversion path normalizes VMD frame-based animation into time-based keys and later re-exports it, the system SHALL record the original frame index semantics and SHALL diagnose any resampling-induced drift beyond tolerance.

#### Scenario: Resampling drift is visible
- **WHEN** time-based editing introduces camera key times that cannot map back to integer VMD frames exactly
- **THEN** the compatibility report SHALL identify the affected track and the maximum frame drift

#### Scenario: Integer frame round-trip stays exact
- **WHEN** keys remain aligned to integer 30 fps frames throughout processing
- **THEN** the exported frame indices SHALL match the original values exactly

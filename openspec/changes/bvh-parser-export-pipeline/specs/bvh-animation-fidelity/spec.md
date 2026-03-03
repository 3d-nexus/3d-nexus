## ADDED Requirements

### Requirement: BVH frame timing and Euler order remain available for re-export
The importer SHALL preserve BVH `Frame Time`, original frame index semantics, and authored Euler rotation order for each animated joint. The exporter SHALL reconstruct the same frame cadence and rotation order when preserved metadata is available.

#### Scenario: Frame time remains exact
- **WHEN** a BVH file defines `Frame Time: 0.0333333`
- **THEN** the imported metadata SHALL preserve that frame time value for export instead of replacing it with a normalized default

#### Scenario: Joint rotation order is not silently normalized
- **WHEN** a BVH joint is authored with channel order `Zrotation Xrotation Yrotation`
- **THEN** the imported metadata SHALL preserve that Euler order and exporter SHALL not rewrite it to `Xrotation Yrotation Zrotation` unless a diagnostic reports normalization

### Requirement: BVH root motion and frame-based animation diagnostics are explicit
The system SHALL preserve root translation semantics and diagnose timing or channel-order drift whenever conversion into time-based IR or another format prevents exact frame-based reconstruction.

#### Scenario: Root translation channel survives round-trip
- **WHEN** a BVH animation drives root translation on all three axes
- **THEN** export SHALL preserve those root motion channels or emit a degradation diagnostic naming the affected axes

#### Scenario: Off-frame normalization is visible
- **WHEN** editing or conversion produces key times that no longer map back to integer BVH frames exactly
- **THEN** the compatibility report SHALL classify BVH animation fidelity as degraded and include the maximum frame drift

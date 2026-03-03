# pmx-skinning Specification

## Purpose
Preserve PMX bone dependency flags, SDEF/QDEF authoring intent, and target-profile skinning fallbacks.

## Requirements

### Requirement: Bone dependency flags required for skin evaluation are preserved
The `MMDImporter` SHALL preserve PMX bone-side flags that affect how skinning behaves in DCC tools, including append/inherit rotation, append/inherit translation, fixed axis, local axis, deform after physics, and external parent references. The `MMDPmxExporter` SHALL restore them when metadata is present.

#### Scenario: Deform-after-physics flag survives round-trip
- **WHEN** a PMX bone is authored to deform after physics
- **THEN** the imported metadata SHALL preserve that flag and export SHALL restore it

#### Scenario: External parent reference retained
- **WHEN** a bone uses an external parent key
- **THEN** the preserved metadata SHALL include that key even if the normalized skeleton graph cannot express it directly

### Requirement: SDEF and QDEF export preserves authoring intent under target limits
The exporter SHALL preserve whether a vertex was authored as SDEF or QDEF when that information is available, and SHALL emit compatibility diagnostics when a target profile requires fallback to simpler weight behavior.

#### Scenario: SDEF intent preserved for PMX export
- **WHEN** imported vertex metadata marks a vertex as authored with SDEF
- **THEN** PMX export SHALL write SDEF data instead of downgrading it to BDEF2 unless diagnostics declare a fallback

#### Scenario: QDEF fallback is explicit
- **WHEN** conversion targets a profile that cannot represent QDEF distinctly
- **THEN** the compatibility report SHALL note the fallback and count the affected vertices

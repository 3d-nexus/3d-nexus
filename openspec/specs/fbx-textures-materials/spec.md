# fbx-textures-materials Specification

## Purpose
Preserve FBX material, media, layered texture, UV routing, and fallback semantics in compatibility-aware workflows.

## Requirements

### Requirement: Layered textures and UV routing are preserved
The `FBXConverter` SHALL preserve layered textures, per-texture blend modes, UV set routing, texture transforms, wrap modes, and filter settings needed to reconstruct authored material bindings. The `FBXExporter` SHALL restore those bindings when metadata is available.

#### Scenario: Texture routed to secondary UV set
- **WHEN** a normal-map texture is authored against UV set `map2`
- **THEN** the imported material metadata SHALL preserve that UV set binding and export SHALL not remap it silently to the primary UV set

#### Scenario: Texture transform survives round-trip
- **WHEN** a texture has non-default translation, rotation, or scaling
- **THEN** those transform values SHALL be preserved across import and export within profile tolerance

### Requirement: Material fallback between legacy and PBR models is explicit
The system SHALL preserve whether a material was authored as legacy Phong/Lambert, Stingray PBS, Maya PBR, or another supported FBX shading model. When export or conversion must fall back to a different model, the compatibility report SHALL describe the fallback and the affected properties.

#### Scenario: PBR fallback is diagnosed
- **WHEN** a Maya PBR material is converted to a target profile that only supports legacy Phong properties
- **THEN** the compatibility report SHALL mark the material capability as `degraded` and list the remapped properties

#### Scenario: Embedded media path normalization remains deterministic
- **WHEN** a texture references embedded media with Unicode or mixed-separator paths
- **THEN** the preserved filename and media binding SHALL remain deterministic across import/export instead of being rewritten ambiguously

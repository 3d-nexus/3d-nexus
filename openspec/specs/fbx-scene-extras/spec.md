# fbx-scene-extras Specification

## Purpose
Preserve FBX cameras, lights, constraints, and user properties needed for DCC-grade round-trip and diagnostics.

## Requirements

### Requirement: FBX cameras and lights round-trip with authored properties
The `FBXConverter` and `FBXExporter` SHALL preserve FBX camera and light objects, including projection mode, field of view, focal length, interest target linkage, clipping planes, light type, color, intensity, cone angles, and cast-shadow flags, either as first-class IR fields or as namespaced metadata required for re-export.

#### Scenario: Camera projection preserved
- **WHEN** an FBX camera uses orthographic projection
- **THEN** the imported scene SHALL preserve the projection mode and export SHALL not silently convert it to perspective

#### Scenario: Spot light cone survives round-trip
- **WHEN** an FBX spot light defines inner and outer cone values
- **THEN** those cone values SHALL be preserved across import and export within configured numeric tolerance

### Requirement: FBX constraints and user properties surface as structured metadata
The `FBXConverter` SHALL preserve supported constraint objects and custom user properties under metadata keys that keep object type, target connections, and authored values. Export SHALL restore supported constraint/user-property types and emit diagnostics for unsupported ones.

#### Scenario: Aim constraint metadata stored
- **WHEN** an FBX file contains an aim constraint linking two models
- **THEN** the imported metadata SHALL identify the constraint type and both connected object identifiers

#### Scenario: Unsupported custom property is diagnosed
- **WHEN** a user property type has no direct exporter mapping
- **THEN** export SHALL preserve the raw property metadata and emit a compatibility diagnostic instead of dropping it silently

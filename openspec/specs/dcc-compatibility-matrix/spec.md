# dcc-compatibility-matrix Specification

## Purpose
Define compatibility profiles, fixture manifests, and report semantics for industrial-grade DCC and runtime validation.

## Requirements

### Requirement: Compatibility profiles and fixture manifests
The system SHALL define named compatibility profiles for `mmd`, `blender-fbx`, `maya-fbx`, `3dsmax-fbx`, `motionbuilder-fbx`, `unity`, and `unreal`. Each profile SHALL reference one or more fixture manifests that declare source tool/version, covered capabilities, expected diagnostics, and numeric tolerances for validation.

#### Scenario: Profile manifest declares tool version
- **WHEN** a fixture is registered for the `maya-fbx` profile
- **THEN** its manifest SHALL include the originating Maya version and the FBX SDK/exporter version used to produce the file

#### Scenario: Capability coverage is explicit
- **WHEN** a fixture only validates pivots and bind poses
- **THEN** the manifest SHALL list only those capabilities instead of implying full-profile coverage

### Requirement: Compatibility reports distinguish exact, normalized, and degraded outcomes
Every import, export, or conversion validation run SHALL produce a compatibility report that classifies each checked capability as `exact`, `normalized`, `degraded`, or `unsupported`, together with structured diagnostics describing the fallback or loss.

#### Scenario: Normalized pass is not reported as exact
- **WHEN** a Maya FBX file is imported with unit normalization but no semantic loss
- **THEN** the report SHALL mark the coordinate capability as `normalized` rather than `exact`

#### Scenario: Unsupported construct is visible in report
- **WHEN** a fixture contains a native feature that the IR cannot round-trip exactly
- **THEN** the report SHALL include at least one diagnostic entry with the capability name, severity, and fallback action

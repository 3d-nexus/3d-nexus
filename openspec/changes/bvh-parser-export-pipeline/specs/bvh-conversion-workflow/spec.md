## ADDED Requirements

### Requirement: BVH participates in converter and compatibility-report workflows
The `nexus-converter` pipeline SHALL accept `bvh` as both an import and export format, and SHALL emit compatibility reports for BVH round-trip and cross-format conversion using the same profile-driven workflow used by FBX and PMX.

#### Scenario: BVH to FBX conversion emits report
- **WHEN** a BVH file is converted to FBX with a compatibility profile selected
- **THEN** the converter SHALL return both the converted payload and a compatibility report that classifies BVH skeleton and animation capabilities

#### Scenario: FBX to BVH conversion reports normalization
- **WHEN** FBX animation contains semantics that BVH cannot represent exactly, such as pivots or layered animation
- **THEN** the compatibility report SHALL mark the affected BVH capability as normalized or degraded instead of reporting an exact pass

### Requirement: Playground and fixtures support BVH validation paths
The browser playground and package-level tests SHALL support loading BVH fixtures, selecting compatibility profiles, and inspecting BVH-related diagnostics in the same workflow used by other formats.

#### Scenario: Playground shows BVH compatibility output
- **WHEN** a user loads a BVH file in the playground and converts it with a selected profile
- **THEN** the UI SHALL render the compatibility report and make the converted file downloadable

#### Scenario: Fixture-driven cross-format tests include BVH
- **WHEN** canonical BVH fixtures are added for parser/exporter validation
- **THEN** package tests SHALL cover BVH round-trip and at least one BVH cross-format conversion path

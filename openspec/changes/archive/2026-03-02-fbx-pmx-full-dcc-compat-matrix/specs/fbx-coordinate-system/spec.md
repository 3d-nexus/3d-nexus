## ADDED Requirements

### Requirement: Coordinate normalization records the exact source frame
The `FBXConverter` SHALL record the exact decoded source coordinate frame, unit scale, handedness, and any root-level normalization transforms under compatibility metadata so that export and validation can distinguish a true no-op round-trip from a normalized interchange.

#### Scenario: Source frame metadata stored
- **WHEN** an FBX scene is imported from a Z-up centimeter source
- **THEN** scene metadata SHALL preserve that the original frame was Z-up and centimeter-based even after IR normalization to the canonical frame

#### Scenario: Handedness change is explicit
- **WHEN** axis conversion requires a handedness flip
- **THEN** the metadata SHALL record that flip and the compatibility report SHALL include it in the coordinate-system result

### Requirement: Export modes distinguish exact round-trip from normalized interchange
The `FBXExporter` SHALL support compatibility-aware export behavior that either reconstructs the original source frame when preserved metadata exists or emits canonical Y-up output while labeling the result as normalized.

#### Scenario: Exact source frame restored
- **WHEN** export runs in a profile that requests exact round-trip and source frame metadata is present
- **THEN** the output FBX SHALL restore the original axis and unit settings instead of forcing canonical settings

#### Scenario: Canonical export stays explicit
- **WHEN** export runs in normalized interchange mode
- **THEN** the compatibility report SHALL mark coordinate-system handling as `normalized` even if geometry values are otherwise correct

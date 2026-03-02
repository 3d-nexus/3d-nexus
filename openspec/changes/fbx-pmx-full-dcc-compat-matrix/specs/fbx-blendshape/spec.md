## ADDED Requirements

### Requirement: Blendshape channel weights and in-between targets are preserved
The `FBXConverter` SHALL preserve each BlendShapeChannel's deform percent, full-weight target value, and any in-between shape thresholds needed for re-export. The `FBXExporter` SHALL reconstruct channel settings and SHALL not collapse authored in-between targets into a single end-state target without a diagnostic.

#### Scenario: Full-weight target retained
- **WHEN** a BlendShapeChannel uses a full-weight value other than 100
- **THEN** the imported metadata SHALL preserve that authored value for export

#### Scenario: In-between targets remain distinguishable
- **WHEN** a blendshape channel contains multiple in-between targets
- **THEN** export SHALL preserve the thresholds for each target or emit a degradation diagnostic if only the final target can be represented

### Requirement: Animated blendshape weights remain bound to authored channels
The system SHALL preserve animation curves that drive blendshape channel weights and SHALL keep channel identity stable so animated morph behavior survives import/export and cross-format conversion.

#### Scenario: Blendshape animation curve preserved
- **WHEN** a blendshape channel named `blink_L` has animated weights
- **THEN** the imported animation metadata SHALL reference `blink_L` and export SHALL not rename or merge it unexpectedly

#### Scenario: Weight-only conversion reports fidelity
- **WHEN** conversion to a target format can preserve weight animation but not in-between targets
- **THEN** the compatibility report SHALL mark the channel as `degraded` with the exact fallback reason

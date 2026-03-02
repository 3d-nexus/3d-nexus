## ADDED Requirements

### Requirement: Animation evaluation preserves authored rotation order and layered composition
The `FBXConverter` SHALL preserve each animated node's authored Euler rotation order, pre/post rotation influence, and AnimationLayer composition order so that sampled transforms match the source DCC evaluation within profile tolerance.

#### Scenario: Non-default rotation order is preserved
- **WHEN** an animated FBX node uses `eEulerZYX`
- **THEN** the imported animation metadata SHALL retain that rotation order and export SHALL not rewrite it to the default order unless a diagnostic reports normalization

#### Scenario: Layered animation remains ordered
- **WHEN** an AnimationStack contains multiple AnimationLayers
- **THEN** the importer SHALL preserve layer order and the validation harness SHALL be able to evaluate the composed result deterministically

### Requirement: Camera and light animation channels are included in compatibility scope
The `FBXConverter` and `FBXExporter` SHALL preserve animation channels that target camera and light properties, including field of view, focal length, intensity, color, cone angles, and visibility, using metadata when no direct IR field exists.

#### Scenario: Camera FOV keys survive round-trip
- **WHEN** an FBX camera has animated field-of-view keys
- **THEN** the exported FBX SHALL retain an equivalent animated camera property curve rather than flattening to a static value

#### Scenario: Light intensity curve preserved
- **WHEN** a light has animated intensity values
- **THEN** the compatibility report SHALL mark the light animation capability as `exact` or `normalized`, but not omit the channel silently

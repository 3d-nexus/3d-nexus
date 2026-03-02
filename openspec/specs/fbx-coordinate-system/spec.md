# fbx-coordinate-system Specification

## Purpose
TBD - created by archiving change pmx-fbx-industrial-grade. Update Purpose after archive.
## Requirements
### Requirement: GlobalSettings axis flags decoded
The `FBXConverter` SHALL read the following properties from the `GlobalSettings` node via `PropertyTable`: `UpAxis` (int, 0=X/1=Y/2=Z), `UpAxisSign` (int, ±1), `FrontAxis` (int), `FrontAxisSign` (int), `CoordAxis` (int), `CoordAxisSign` (int). If any property is absent, it SHALL default to Y-up right-handed FBX convention (UpAxis=1, UpAxisSign=1, FrontAxis=2, FrontAxisSign=1, CoordAxis=0, CoordAxisSign=1).

#### Scenario: Default FBX convention detected
- **WHEN** `GlobalSettings` has no axis properties (older FBX)
- **THEN** `FBXConverter` SHALL assume Y-up right-handed and apply a no-op (identity) axis-swap

### Requirement: Axis-swap matrix applied to root node
The `FBXConverter` SHALL build a 4×4 rotation matrix from the decoded axis flags that maps the FBX native coordinate frame to the nexus-3d canonical Y-up right-handed frame. This matrix SHALL be pre-multiplied into `scene.rootNode.transformation`. Individual child node transformations SHALL NOT be modified.

#### Scenario: Z-up → Y-up conversion
- **WHEN** `GlobalSettings` specifies Z-up (UpAxis=2, UpAxisSign=1)
- **THEN** the root node transformation SHALL include a −90° X-axis rotation, so that a vertex at FBX `(0, 0, 1)` maps to IR `(0, 1, 0)`

#### Scenario: Y-up identity no-op
- **WHEN** `GlobalSettings` specifies Y-up (UpAxis=1) with default signs
- **THEN** the root node transformation SHALL remain the identity matrix (no modification)

### Requirement: UnitScaleFactor applied
The `FBXConverter` SHALL read `UnitScaleFactor` from `GlobalSettings` (float, default 1.0 for cm). It SHALL apply a uniform scale of `UnitScaleFactor / 100.0` to convert from cm to meters by scaling the root node transformation (pre-multiplied into the axis-swap matrix). The applied factor SHALL be stored in `scene.metadata["nexus:unitScaleFactor"]` as `{ type: AiMetadataType.FLOAT, data: factor }`.

#### Scenario: cm to meter scale applied
- **WHEN** `UnitScaleFactor = 1.0` (FBX default = 1 cm)
- **THEN** `scene.metadata["nexus:unitScaleFactor"].data` SHALL be `0.01`

#### Scenario: Maya meter units — no scaling
- **WHEN** `UnitScaleFactor = 100.0` (Maya meters)
- **THEN** the applied scale factor SHALL be `1.0` (100/100) and the scene geometry is already in meters

### Requirement: FBX exporter writes canonical GlobalSettings
The `FBXExporter` SHALL write a `GlobalSettings` section with: `UpAxis = 1`, `UpAxisSign = 1`, `FrontAxis = 2`, `FrontAxisSign = 1`, `CoordAxis = 0`, `CoordAxisSign = 1`, `UnitScaleFactor = 1.0` (i.e., export in Y-up right-handed with 1-unit = 1 scene-unit, no additional scaling).

#### Scenario: GlobalSettings present in output
- **WHEN** `FBXExporter.write(scene)` is called
- **THEN** the output SHALL contain `GlobalSettings { Properties70 { P: "UpAxis", … } }` with UpAxis value 1


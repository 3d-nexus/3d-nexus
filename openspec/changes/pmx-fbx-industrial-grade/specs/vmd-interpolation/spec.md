## ADDED Requirements

### Requirement: VMD Bezier interpolation parsed into structured form
The `VmdParser` SHALL parse the 64-byte interpolation block of each `VmdBoneFrame` into four `VmdInterpolation` structs — one per axis: X, Y, Z, R (rotation). Each struct SHALL have `{ ax: number, ay: number, bx: number, by: number }` with values in range 0–127.

#### Scenario: Interpolation bytes decoded per axis
- **WHEN** a VMD bone frame has interpolation bytes where `data[0]=20, data[16]=107, data[32]=20, data[48]=107`
- **THEN** the X-axis interpolation SHALL be `{ ax:20, ay:20, bx:107, by:107 }` (reflecting the VMD interleaved layout)

#### Scenario: Linear interpolation (all 20/107 pattern)
- **WHEN** a VMD bone frame uses the standard linear interpolation preset (ax=ay=20, bx=by=107)
- **THEN** the four structured interpolations SHALL each have `ax=20, ay=20, bx=107, by=107`

### Requirement: VMD interpolation propagated into IR keyframes
The `MMDImporter` SHALL attach the parsed `VmdInterpolation[]` to each `AiVectorKey` (position) and `AiQuatKey` (rotation) via their `interpolation` field as `{ vmd: VmdInterpolation[] }`.

#### Scenario: Position keyframe carries interpolation
- **WHEN** a VMD bone frame is converted to `AiVectorKey`
- **THEN** `key.interpolation` SHALL be defined and `(key.interpolation as any).vmd` SHALL have 4 entries

### Requirement: VMD exporter writes Bezier interpolation bytes
The `MMDVmdExporter` SHALL read `AiVectorKey.interpolation?.vmd` and `AiQuatKey.interpolation?.vmd` and serialize them back into the 64-byte VMD interleaved layout. If `interpolation` is absent, the exporter SHALL write the default linear preset (ax=ay=20, bx=by=107) for all four axes.

#### Scenario: Custom interpolation round-trips
- **WHEN** a VMD is imported then exported
- **THEN** the 64 interpolation bytes of each bone frame SHALL be byte-identical to the original

#### Scenario: Missing interpolation writes linear default
- **WHEN** `AiVectorKey.interpolation` is `undefined`
- **THEN** the exported 64-byte block SHALL contain the standard linear preset for all four axes

### Requirement: VMD camera frames exported
The `MMDVmdExporter` SHALL write camera keyframes from `scene.cameras[]` paired with a `VmdCameraFrame`-compatible structure. If `scene.metadata["mmd:cameraFrames"]` exists (JSON, set during import), each entry SHALL be serialized: `frame` (uint32), `distance` (float32), `position` (float32×3), `rotation` (float32×3), `fov` (uint32), `perspective` (uint8).

#### Scenario: Camera frame count written
- **WHEN** `scene.metadata["mmd:cameraFrames"]` contains 50 entries
- **THEN** the exported VMD camera section header SHALL write count `uint32 = 50`

#### Scenario: No camera metadata writes zero frames
- **WHEN** `scene.metadata["mmd:cameraFrames"]` is absent
- **THEN** the camera section SHALL write count `uint32 = 0` without error

### Requirement: VMD IK frames exported
The `MMDVmdExporter` SHALL write IK enable/disable frames from `scene.metadata["mmd:ikFrames"]` (JSON) if present, with the correct VMD IK frame binary layout: `frame` (uint32), `show` (uint8), `ikCount` (uint32), per-IK `{ name[20], enable: uint8 }`.

#### Scenario: IK frame section written
- **WHEN** `scene.metadata["mmd:ikFrames"]` contains 5 IK frames
- **THEN** the exported VMD IK frame section header SHALL write count `uint32 = 5`

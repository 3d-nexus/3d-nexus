# fbx-animation Specification

## Purpose
TBD - created by archiving change pmx-fbx-industrial-grade. Update Purpose after archive.
## Requirements
### Requirement: AnimationStack → AiAnimation mapping
The `FBXConverter` SHALL produce one `AiAnimation` per `FbxAnimationStack`. The animation `name` SHALL equal the stack's `Description` property (or its object name if absent). `duration` SHALL be derived from `LocalStop - LocalStart` in FBX ticks divided by `FBX_TICKS_PER_SECOND = 46186158000`. `ticksPerSecond` SHALL be `1.0`.

#### Scenario: Animation duration calculated from ticks
- **WHEN** an AnimationStack has `LocalStart = 0` and `LocalStop = 461861580`
- **THEN** `animation.duration` SHALL be `10.0` seconds (461861580 / 46186158)

### Requirement: AnimationCurveNode → AiNodeAnim channel
For each `FbxAnimationLayer` child of the stack, the `FBXConverter` SHALL traverse `FbxAnimationCurveNode` objects connected to each `FbxModel`. Translation CurveNodes (`d|X`, `d|Y`, `d|Z`) SHALL produce `AiNodeAnim.positionKeys`. Scaling CurveNodes SHALL produce `AiNodeAnim.scalingKeys`. Rotation CurveNodes SHALL be converted from Euler degrees to `AiQuaternion` using the node's `RotationOrder` property (default `eEulerXYZ` → compose Z then Y then X).

#### Scenario: Translation keys extracted
- **WHEN** a model has a T CurveNode with 5 keyframes on d|X, d|Y, d|Z
- **THEN** `AiNodeAnim.positionKeys.length` SHALL be 5 (or the max of d|X, d|Y, d|Z key counts, with missing axes sampled at their last value)

#### Scenario: Rotation Euler to quaternion
- **WHEN** a rotation CurveNode at time T has Euler values `(0°, 90°, 0°)` with default EulerXYZ order
- **THEN** `AiQuatKey.value` SHALL equal the quaternion for a 90° Y-axis rotation (within float32 precision)

### Requirement: AnimationCurve time and value parsing
The `FBXConverter` SHALL read `KeyTime` as a `BigInt64Array` (or `int64` values via `DataView.getBigInt64`) and convert each value to seconds by dividing by `46186158000n`. `KeyValueFloat` SHALL be read as a `Float32Array`. If an AnimationCurve has no keys, the CurveNode axis SHALL use the model's default property value.

#### Scenario: Key time converted to seconds
- **WHEN** a keyframe has `KeyTime = 46186158000` (exactly 1 second)
- **THEN** `AiVectorKey.time` SHALL be `1.0`

### Requirement: AnimationStack export
The `FBXExporter` SHALL write one `AnimationStack`, one `AnimationLayer`, and the required `AnimationCurveNode` + `AnimationCurve` nodes per `AiAnimation`. For each `AiNodeAnim`, it SHALL emit T/R/S CurveNode triplets connected to the corresponding `Model` node. Rotation keys SHALL be converted from `AiQuaternion` back to Euler ZYX degrees.

#### Scenario: AnimationStack header written
- **WHEN** a scene has one `AiAnimation` named `"Take 001"`
- **THEN** the FBX output SHALL contain `AnimationStack: "AnimationStack::Take 001"` with `LocalStart` and `LocalStop` in ticks

#### Scenario: Translation curve values written
- **WHEN** `AiNodeAnim.positionKeys` has `[{ time:0, value:{x:1,y:2,z:3} }]`
- **THEN** the d|X AnimationCurve SHALL contain `KeyTime: *1 {0}` and `KeyValueFloat: *1 {1.0}` (and similarly Y=2.0, Z=3.0)


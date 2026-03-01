## ADDED Requirements

### Requirement: Rigid body metadata round-trip
The `MMDImporter` SHALL serialize all `PmxRigidBody` objects to JSON and store them as `scene.metadata["mmd:rigidBodies"]` with `type: AiMetadataType.AISTRING`. The JSON SHALL preserve: `name`, `boneIndex`, `groupIndex`, `nonCollisionGroupMask`, `shape` (0=sphere/1=box/2=capsule), `size` (`AiVector3D`), `position`, `rotation`, `mass`, `translateDamping`, `rotateDamping`, `repulsion`, `friction`, `physicsMode` (0=static/1=dynamic/2=boneAlign).

#### Scenario: Rigid body count preserved
- **WHEN** a PMX model with 15 rigid bodies is imported
- **THEN** `JSON.parse(scene.metadata["mmd:rigidBodies"].data as string)` SHALL have length 15

#### Scenario: Physics mode preserved
- **WHEN** a rigid body has `physicsMode = 1` (dynamic)
- **THEN** the serialized JSON entry SHALL have `physicsMode: 1`

### Requirement: Joint metadata round-trip
The `MMDImporter` SHALL serialize all `PmxJoint` objects to JSON and store them as `scene.metadata["mmd:joints"]` with `type: AiMetadataType.AISTRING`. The JSON SHALL preserve: `name`, `type` (joint type), `rigidbodyIndexA`, `rigidbodyIndexB`, `position`, `rotation`, `translationLimitMin`, `translationLimitMax`, `rotationLimitMin`, `rotationLimitMax`, `springTranslateFactor`, `springRotateFactor`.

#### Scenario: Joint constraint limits preserved
- **WHEN** a PMX joint has `translationLimitMin = {x:-1, y:0, z:-1}`
- **THEN** the JSON entry SHALL contain `"translationLimitMin": {"x":-1,"y":0,"z":-1}`

### Requirement: PMX exporter writes rigid body blocks
The `MMDPmxExporter` SHALL parse `scene.metadata["mmd:rigidBodies"]` and write a binary PMX rigid body section. Each entry SHALL be serialized in the exact PMX 2.0 rigid body struct layout (name[JP/EN], bone index, group, non-collision mask, shape, size×3, position×3, rotation×3, mass, translate/rotate damping, repulsion, friction, physics mode).

#### Scenario: Rigid body section written with correct count
- **WHEN** a model with 8 rigid bodies is exported
- **THEN** the PMX rigid body section header SHALL write the count as `uint32 = 8`

#### Scenario: Missing metadata produces empty section
- **WHEN** `scene.metadata["mmd:rigidBodies"]` is absent
- **THEN** the exporter SHALL write rigid body count `= 0` and no body data, without throwing

### Requirement: PMX exporter writes joint blocks
The `MMDPmxExporter` SHALL parse `scene.metadata["mmd:joints"]` and write a binary PMX joint section following the joint struct layout.

#### Scenario: Joint count in output
- **WHEN** a model with 12 joints is imported and re-exported
- **THEN** the PMX joint section header SHALL write count `= 12`

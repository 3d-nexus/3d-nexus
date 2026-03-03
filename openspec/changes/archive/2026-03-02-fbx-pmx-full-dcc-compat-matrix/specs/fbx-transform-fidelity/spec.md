## ADDED Requirements

### Requirement: FBX transform stack terms are preserved for round-trip
The `FBXConverter` SHALL preserve the original FBX transform stack terms for each `FbxModel`, including local translation/rotation/scaling, rotation order, pre-rotation, post-rotation, rotation pivot, rotation offset, scaling pivot, scaling offset, geometric translation, geometric rotation, geometric scaling, and inherit type. The evaluated transform SHALL populate the IR node transform, and the preserved stack SHALL be stored in metadata under `fbx:transformStack`.

#### Scenario: Pivot stack captured in metadata
- **WHEN** an FBX model defines non-zero rotation pivot and scaling pivot values
- **THEN** `node.metadata["fbx:transformStack"]` SHALL include both pivot vectors and the evaluated IR transform SHALL reflect them

#### Scenario: Inherit type preserved
- **WHEN** an FBX model uses an inherit type other than the default
- **THEN** the preserved stack metadata SHALL include that inherit type so export can reconstruct it

### Requirement: FBX exporter reconstructs pivot-aware transform stacks
The `FBXExporter` SHALL reconstruct FBX transform stack properties from preserved metadata when available. If preserved metadata is absent, it SHALL export a canonical stack equivalent to the evaluated IR transform and emit a compatibility diagnostic indicating that authoring pivots were not preserved.

#### Scenario: Preserved pivot stack round-trips
- **WHEN** a node imported from FBX is exported without modification and still carries `fbx:transformStack`
- **THEN** the output FBX SHALL write the same pivot-related properties instead of collapsing them to identity

#### Scenario: Canonical fallback is diagnosed
- **WHEN** a scene node is created directly in IR without FBX stack metadata
- **THEN** export SHALL succeed with canonical FBX transforms and record a diagnostic that the pivot stack was synthesized

### Requirement: Instancing and negative scale semantics remain distinguishable
The `FBXConverter` SHALL preserve instanced geometry relationships and negative-scale handedness changes so validation can distinguish shared-geometry instances from duplicated geometry and mirrored transforms from ordinary scales.

#### Scenario: Shared geometry remains instanced
- **WHEN** two FBX models connect to the same geometry object
- **THEN** the imported representation SHALL preserve that they are instances of the same source geometry rather than silently duplicating compatibility state

#### Scenario: Mirrored transform is reported
- **WHEN** a node has an odd number of negative scale axes that changes handedness
- **THEN** the converter SHALL preserve that state in metadata and the compatibility report SHALL mention the handedness change

# pmx-physics-export Specification

## Purpose
Preserve PMX rigid body, joint, and soft-body-compatible physics metadata required for industrial-grade round-trip.

## Requirements

### Requirement: PMX physics metadata preserves solver-relevant fields
The `MMDImporter` SHALL preserve rigid body and joint fields needed for DCC-grade round-trip, including collision groups, damping, repulsion, friction, spring factors, joint type variants, and any parser-accessible solver metadata that cannot be represented directly in the IR.

#### Scenario: Joint spring factors remain available
- **WHEN** a PMX joint has non-zero spring translation and rotation factors
- **THEN** the imported metadata SHALL preserve those values without numeric truncation beyond float32 precision

#### Scenario: Collision mask survives round-trip
- **WHEN** a rigid body excludes multiple collision groups
- **THEN** the non-collision mask SHALL be preserved for export instead of being recomputed heuristically

### Requirement: Soft-body-compatible PMX blocks are preserved explicitly
If a PMX file contains soft-body-related sections or versioned extension blocks that are not yet supported as first-class IR physics objects, the importer SHALL preserve their raw structured metadata and the exporter SHALL restore them or emit an explicit compatibility diagnostic.

#### Scenario: Unsupported soft-body block is not dropped silently
- **WHEN** a PMX 2.1 file contains soft-body data
- **THEN** the importer SHALL preserve it under `mmd:softBodies` or an equivalent metadata key and the compatibility report SHALL mention whether export restored or normalized it

#### Scenario: Missing physics extension metadata remains visible
- **WHEN** export cannot reconstruct a preserved physics extension block exactly
- **THEN** the compatibility report SHALL classify the physics result as `degraded` rather than `exact`

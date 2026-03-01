## ADDED Requirements

### Requirement: BlendShape deformer traversal
The `FBXConverter` SHALL, for each `FbxGeometry`, query child `FbxDeformer` objects with `DeformerType = "BlendShape"`. For each BlendShape, it SHALL collect child `FbxDeformer` objects with `DeformerType = "BlendShapeChannel"`.

#### Scenario: BlendShape chain connected
- **WHEN** a geometry has one BlendShape with 4 BlendShapeChannel children
- **THEN** `FbxDocument.getChildren(blendShapeId)` SHALL yield 4 channel objects

### Requirement: BlendShapeChannel → AiAnimMesh delta expansion
For each `BlendShapeChannel`, the `FBXConverter` SHALL find its connected `Shape` (a `FbxGeometry` with type `"Shape"`). The Shape contains `Indexes` (sparse int32 array of affected vertex indices) and `Vertices` (float64 array of length `3 × Indexes.length` representing position deltas). The converter SHALL expand this into a dense `AiAnimMesh`:
- `AiAnimMesh.vertices[i] = baseMesh.vertices[i] + delta` for `i` in Indexes
- `AiAnimMesh.vertices[j] = baseMesh.vertices[j]` for all other `j`
- `AiAnimMesh.name` = BlendShapeChannel name

#### Scenario: Sparse delta expanded to dense
- **WHEN** a BlendShapeChannel affects 3 of 500 vertices
- **THEN** the resulting `AiAnimMesh.vertices.length` SHALL be 500

#### Scenario: Delta position applied
- **WHEN** Shape.Indexes = [10] and Shape.Vertices = [0.0, 5.0, 0.0] (delta +5 on Y)
- **THEN** `animMesh.vertices[10].y` SHALL equal `baseMesh.vertices[10].y + 5.0`

### Requirement: FBX exporter writes BlendShape deformer nodes
The `FBXExporter` SHALL, for each `AiMesh` with non-empty `morphTargets[]`, emit one `Deformer:BlendShape`, one `Deformer:BlendShapeChannel` per morph target, and one `Geometry:Shape` node per channel. The Shape `Indexes` and `Vertices` arrays SHALL be the sparse non-base-identical entries (diff from base mesh). `Connections` SHALL include BlendShapeChannel→BlendShape, BlendShape→Geometry, Shape→BlendShapeChannel.

#### Scenario: BlendShape node written
- **WHEN** exporting a mesh with 2 morph targets
- **THEN** the FBX output SHALL contain one `Deformer:BlendShape` and 2 `Deformer:BlendShapeChannel` nodes

#### Scenario: Shape sparse delta written correctly
- **WHEN** morph target "blink" deforms only 8 vertices
- **THEN** the `Shape` node for that channel SHALL have `Indexes: *8 { … }` and `Vertices: *24 { … }` (8×3 floats)

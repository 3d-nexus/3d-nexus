# fbx-skinning Specification

## Purpose
TBD - created by archiving change pmx-fbx-industrial-grade. Update Purpose after archive.
## Requirements
### Requirement: FBX Skin deformer traversal
The `FBXConverter` SHALL, for each `FbxGeometry`, query the connection graph for child `FbxDeformer` objects with `DeformerType = "Skin"`. For each Skin, it SHALL collect all child `FbxDeformer` objects with `DeformerType = "Cluster"`.

#### Scenario: Skin deformer connected to geometry
- **WHEN** an FBX geometry has a child Skin deformer with 3 Cluster children
- **THEN** `FbxDocument.getChildren(geometryId)` SHALL yield the Skin, and `getChildren(skinId)` SHALL yield 3 Clusters

### Requirement: Cluster weight extraction into AiBone
For each `Cluster`, the `FBXConverter` SHALL read `Indexes` (int array) and `Weights` (double array) as parallel arrays and accumulate `AiVertexWeight { vertexId: Indexes[i], weight: Weights[i] }` entries. Each Cluster's associated model node (via `Model` connection) SHALL provide the bone `name`. `TransformMatrix` (16 float64 values, column-major) SHALL be read into `AiBone.offsetMatrix`. Weights SHALL be normalized per-vertex after all Clusters are processed (sum → 1.0).

#### Scenario: Vertex weight accumulation
- **WHEN** a Cluster references vertex 10 with weight 0.6 and another Cluster references vertex 10 with weight 0.4
- **THEN** after normalization, the two `AiVertexWeight` entries for vertex 10 SHALL have weights 0.6 and 0.4 (already normalized)

#### Scenario: TransformMatrix → offsetMatrix
- **WHEN** a Cluster has `TransformMatrix` as 16 float64 values
- **THEN** `AiBone.offsetMatrix.data` SHALL be a `Float32Array` with the same 16 values cast to float32

#### Scenario: Zero-weight entries omitted
- **WHEN** a Cluster has a weight of 0.0 for vertex 5
- **THEN** no `AiVertexWeight` entry SHALL be created for vertex 5 on that bone

### Requirement: AiMesh.bones populated
The `FBXConverter` SHALL write the assembled `AiBone[]` list to `AiMesh.bones`. If no Skin deformer is found, `AiMesh.bones` SHALL be an empty array.

#### Scenario: Bones attached to mesh
- **WHEN** an FBX mesh has skinning with 20 bones
- **THEN** `mesh.bones.length` SHALL be 20

### Requirement: FBX exporter writes Skin + Cluster deformer nodes
The `FBXExporter` SHALL, for each `AiMesh` with non-empty `bones[]`, emit a `Deformer:Skin` node and one `Deformer:Cluster` child node per bone. Each Cluster SHALL contain `Indexes` (int array), `Weights` (double array), and `TransformMatrix` (16 float64 values). `Connections` SHALL include `OO` links: Cluster→Skin, Skin→Geometry.

#### Scenario: Skin node written
- **WHEN** exporting a mesh with 5 bones
- **THEN** the output FBX SHALL contain one `Deformer: "Deformer::Skin", "Skin"` node and 5 `Deformer: "Deformer::Cluster0"…"Deformer::Cluster4"` nodes

#### Scenario: Cluster Indexes and Weights arrays
- **WHEN** bone 0 affects vertices [2, 5, 7] with weights [0.8, 1.0, 0.5]
- **THEN** `Indexes: *3 { 2, 5, 7 }` and `Weights: *3 { 0.8, 1.0, 0.5 }` SHALL appear inside the Cluster node


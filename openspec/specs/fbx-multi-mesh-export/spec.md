# fbx-multi-mesh-export Specification

## Purpose
TBD - created by archiving change pmx-fbx-industrial-grade. Update Purpose after archive.
## Requirements
### Requirement: Multiple Geometry + Model nodes emitted
The `FBXExporter` SHALL emit one `Geometry` node and one `Model` node per entry in `scene.meshes[]`. Geometry node IDs SHALL be unique (e.g. auto-incremented from a base ID). Model node IDs SHALL also be unique. Each Model's name SHALL equal `AiMesh.name` if non-empty, or `"Mesh_N"` where N is the mesh index.

#### Scenario: Two-mesh scene produces two Geometry nodes
- **WHEN** `scene.meshes.length === 2`
- **THEN** the FBX output SHALL contain exactly two `Geometry:` node declarations under `Objects`

#### Scenario: Mesh names preserved
- **WHEN** `scene.meshes[0].name === "Body"` and `scene.meshes[1].name === "Hair"`
- **THEN** the FBX output SHALL contain `Model: "Model::Body"` and `Model: "Model::Hair"`

### Requirement: Connections block links each Model to its Geometry and Material
The `FBXExporter` SHALL write one `C: "OO", modelId, geometryId` and one `C: "OO", materialId, modelId` per mesh. If the mesh has a Skin deformer, `C: "OO", skinId, geometryId` SHALL also be written. Each Model SHALL be parented to the root node via `C: "OO", modelId, rootModelId`.

#### Scenario: Geometry-to-Model connection written
- **WHEN** exporting two meshes
- **THEN** the `Connections` section SHALL contain two `C: "OO", <modelId>, <geometryId>` entries (one per mesh)

#### Scenario: Model-to-root parenting
- **WHEN** the scene has a root node and two mesh nodes
- **THEN** both mesh Model nodes SHALL have a connection to the root Model ID in the Connections block

### Requirement: Per-mesh material assignment in multi-mesh export
The `FBXExporter` SHALL look up `scene.materials[mesh.materialIndex]` for each mesh and emit (or reuse) the corresponding FBX `Material` node. If two meshes share the same `materialIndex`, only one Material node SHALL be emitted and both shall reference it in Connections.

#### Scenario: Shared material not duplicated
- **WHEN** two meshes both have `materialIndex = 0`
- **THEN** only one `Material:` node SHALL appear in the `Objects` section

#### Scenario: Distinct materials emitted per mesh
- **WHEN** three meshes have `materialIndex = 0, 1, 2`
- **THEN** three distinct `Material:` nodes SHALL appear in the output


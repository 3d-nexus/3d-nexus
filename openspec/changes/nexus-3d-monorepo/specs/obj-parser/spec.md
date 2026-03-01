## ADDED Requirements

### Requirement: OBJ text format parsing
`nexus-obj` SHALL provide an `ObjFileParser` class that accepts a `string` (decoded OBJ file contents) and produces an `ObjModel` in-memory DOM, processing all standard OBJ directives: `v` (vertex), `vn` (normal), `vt` (texture coord), `f` (face), `o` (object), `g` (group), `usemtl`, `mtllib`, `s` (smoothing group), and `#` (comment).

#### Scenario: Vertex parsing
- **WHEN** an OBJ line is `v 1.0 2.0 3.0`
- **THEN** one `AiVector3D { x:1, y:2, z:3 }` SHALL be added to `model.vertices`

#### Scenario: Face with texture and normal indices
- **WHEN** an OBJ line is `f 1/2/3 4/5/6 7/8/9`
- **THEN** an `ObjFace` SHALL be created with three vertex/texture/normal index triples (converted to 0-based)

#### Scenario: Face without texture coordinates
- **WHEN** an OBJ line is `f 1//2 3//4 5//6`
- **THEN** texture coord indices SHALL be absent (`-1`) and normal indices SHALL be parsed correctly

#### Scenario: Negative index references
- **WHEN** an OBJ face uses relative indices (e.g. `f -1 -2 -3`)
- **THEN** indices SHALL be resolved relative to the current vertex count (OBJ spec)

#### Scenario: Comment lines skipped
- **WHEN** a line begins with `#`
- **THEN** the line SHALL be ignored without error

### Requirement: MTL material file parsing
`nexus-obj` SHALL provide an `ObjFileMtlParser` class that parses MTL file contents and populates `ObjMaterial` entries for each `newmtl` block, supporting: `Ka`, `Kd`, `Ks`, `Ke`, `Ns`, `Ni`, `d`, `Tr`, `illum`, `map_Kd`, `map_Ka`, `map_Ks`, `map_Ns`, `map_bump` / `bump`, `map_d`, `disp`.

#### Scenario: Diffuse color
- **WHEN** an MTL line is `Kd 0.8 0.6 0.4`
- **THEN** `material.diffuse` SHALL be `{ r:0.8, g:0.6, b:0.4 }`

#### Scenario: Diffuse texture map
- **WHEN** an MTL line is `map_Kd textures/albedo.png`
- **THEN** `material.textureDiffuse` SHALL be `"textures/albedo.png"`

#### Scenario: Dissolved alpha
- **WHEN** an MTL line is `d 0.5`
- **THEN** `material.dissolve` SHALL be `0.5`

### Requirement: OBJ importer (DOM → AiScene IR)
`nexus-obj` SHALL provide an `ObjFileImporter` that implements `BaseImporter`, converts an `ObjModel` DOM to a valid `AiScene`, and handles multi-object / multi-group files by emitting one `AiMesh` per material group.

#### Scenario: canRead identifies OBJ
- **WHEN** `canRead` is called with a buffer whose text starts with `v ` or `#` lines
- **THEN** it SHALL return `true` for `.obj` filename extension

#### Scenario: Multiple objects
- **WHEN** an OBJ file contains two `o` sections
- **THEN** the resulting `AiScene` SHALL contain two separate `AiMesh` entries referenced from separate child nodes

#### Scenario: Material assignment
- **WHEN** a face group uses `usemtl Metal`
- **THEN** the corresponding `AiMesh.materialIndex` SHALL point to an `AiMaterial` with name `"Metal"`

#### Scenario: Missing MTL file is non-fatal
- **WHEN** an OBJ references `mtllib scene.mtl` but no MTL buffer is provided
- **THEN** the importer SHALL emit a warning on `ImportResult.warnings` but NOT throw, producing a default material instead

### Requirement: OBJ exporter (AiScene IR → OBJ/MTL text)
`nexus-obj` SHALL provide an `ObjExporter` that implements `BaseExporter`, serialises an `AiScene` to OBJ text (`ArrayBuffer` of UTF-8) and separately stores the MTL content accessible via `ObjExporter.getMtlContent(): string`.

#### Scenario: Vertex round-trip
- **WHEN** a scene with `[{x:1,y:2,z:3}]` vertex is exported then re-imported
- **THEN** the re-imported vertex SHALL be `{x:1, y:2, z:3}` within float32 precision

#### Scenario: MTL reference in OBJ header
- **WHEN** the scene has materials
- **THEN** the exported OBJ text SHALL contain a `mtllib` directive naming the companion MTL file

#### Scenario: No normal data
- **WHEN** a mesh has no normals
- **THEN** the exported OBJ SHALL omit `vn` lines and use `f v//` face format (no normal index)

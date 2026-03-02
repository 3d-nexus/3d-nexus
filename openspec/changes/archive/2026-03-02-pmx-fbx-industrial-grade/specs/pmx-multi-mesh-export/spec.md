## ADDED Requirements

### Requirement: Multi-mesh PMX export — merged vertex stream
The `MMDPmxExporter` SHALL export ALL `scene.meshes[]` into a single PMX model. Vertex arrays from each mesh SHALL be concatenated in order, with face indices offset accordingly. Each mesh's material index SHALL determine the PMX material assignment for that vertex range.

#### Scenario: Two-mesh scene vertex count
- **WHEN** a scene has two meshes with 100 and 200 vertices respectively
- **THEN** the exported PMX SHALL have 300 vertices total

#### Scenario: Face index offset applied
- **WHEN** mesh[1] starts at vertex offset 100
- **THEN** mesh[1]'s face indices in the exported PMX SHALL each be offset by 100

### Requirement: Multi-mesh PMX export — one material per mesh
The `MMDPmxExporter` SHALL emit one PMX material block per `AiMesh`, referencing the corresponding `scene.materials[mesh.materialIndex]`. The PMX material's face index range SHALL correctly span only the faces belonging to that mesh.

#### Scenario: Material count equals mesh count
- **WHEN** a scene has 3 meshes each with a distinct material
- **THEN** the exported PMX SHALL contain 3 material blocks

#### Scenario: PMX material face range
- **WHEN** mesh[0] has 60 triangular faces and mesh[1] has 40
- **THEN** material[0]'s face count SHALL be 180 (60×3) and material[1]'s SHALL be 120 (40×3)

### Requirement: Full material property export
The `MMDPmxExporter` SHALL write all PMX material fields from the corresponding `AiMaterial` properties:
- Diffuse color (`$clr.diffuse` → RGBA float32×4)
- Specular color and coefficient (`$clr.specular` + `$mat.shininess`)
- Ambient color (`$clr.ambient`)
- Edge color and width (`mmd:edgeColor`, `mmd:edgeSize`)
- Sphere texture mode (`mmd:sphereMode`)
- Toon index (`mmd:toonIndex`)

#### Scenario: Diffuse color written correctly
- **WHEN** `material.properties` contains `{ key: "$clr.diffuse", data: { r:0.9, g:0.8, b:0.7, a:1.0 } }`
- **THEN** the PMX material binary SHALL contain those four float32 values at the diffuse offset

#### Scenario: Missing property uses safe default
- **WHEN** a material has no `$clr.specular` property
- **THEN** the exporter SHALL write specular `{0, 0, 0}` and coefficient `0` without throwing

### Requirement: Texture index resolution on export
The `MMDPmxExporter` SHALL build a deduplicated texture path list from all `"$tex.file"` material properties, write this list as the PMX texture section, and assign correct per-material texture indices.

#### Scenario: Shared texture deduplicated
- **WHEN** two materials reference the same texture path `"body.png"`
- **THEN** the PMX texture section SHALL contain `"body.png"` only once and both materials SHALL reference the same index

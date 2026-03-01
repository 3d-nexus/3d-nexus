## ADDED Requirements

### Requirement: PMX binary format parsing
`nexus-mmd` SHALL provide a `PmxParser` class that reads a PMX 2.0/2.1 binary `ArrayBuffer` using `DataView`, populating a `PmxDocument` DOM with: `PmxSetting` (header), `PmxVertex[]`, `number[]` (face indices), `string[]` (texture paths), `PmxMaterial[]`, `PmxBone[]`, `PmxMorph[]`, `PmxFrame[]`, `PmxRigidBody[]`, `PmxJoint[]`, and (for PMX 2.1) `PmxSoftBody[]`.

#### Scenario: PMX magic bytes validation
- **WHEN** `PmxParser.parse` is called with an `ArrayBuffer`
- **THEN** it SHALL verify the first 4 bytes are `PMX ` (0x50 0x4D 0x58 0x20) and throw `ParseError` otherwise

#### Scenario: UTF-8 encoded string
- **WHEN** `PmxSetting.encoding` is `1` (UTF-8)
- **THEN** all name strings SHALL be decoded using `TextDecoder("utf-8")`

#### Scenario: UTF-16LE encoded string
- **WHEN** `PmxSetting.encoding` is `0` (UTF-16LE)
- **THEN** all name strings SHALL be decoded using `TextDecoder("utf-16le")`

#### Scenario: BDEF4 vertex skinning
- **WHEN** a PMX vertex has skinning type `BDEF4`
- **THEN** `vertex.skinning` SHALL contain 4 `{ boneIndex, weight }` pairs

#### Scenario: SDEF vertex skinning
- **WHEN** a PMX vertex has skinning type `SDEF`
- **THEN** `vertex.skinning` SHALL contain `{ boneIndex1, boneIndex2, weight, c, r0, r1 }` fields

#### Scenario: Variable index size
- **WHEN** `PmxSetting.vertexIndexSize` is `4`
- **THEN** all face index reads SHALL use `DataView.getUint32` (little-endian)

### Requirement: PMD binary format parsing
`nexus-mmd` SHALL provide a `PmdParser` class that reads a PMD binary `ArrayBuffer` and produces a `PmdDocument` DOM with: `PmdHeader`, `PmdVertex[]`, `number[]` (face indices), `PmdMaterial[]`, `PmdBone[]`, `PmdIk[]`, `PmdMorph[]`.

#### Scenario: PMD magic validation
- **WHEN** `PmdParser.parse` is called
- **THEN** it SHALL verify the first 3 bytes are `Pmd` (0x50 0x6D 0x64) and throw otherwise

#### Scenario: Shift_JIS string decoding
- **WHEN** a PMD bone name is encoded in Shift_JIS
- **THEN** the decoded string SHALL correctly map Shift_JIS byte sequences to Unicode characters

### Requirement: VMD binary format parsing
`nexus-mmd` SHALL provide a `VmdParser` class that reads a VMD `ArrayBuffer` and produces a `VmdDocument` with: `VmdHeader`, `VmdBoneFrame[]`, `VmdMorphFrame[]`, `VmdCameraFrame[]`, `VmdLightFrame[]`, `VmdShadowFrame[]`, `VmdIkFrame[]`.

#### Scenario: VMD header version
- **WHEN** `VmdParser.parse` is called
- **THEN** it SHALL verify the magic string `"Vocaloid Motion Data 0002"` (30 bytes) or `"Vocaloid Motion Data file"` (30 bytes) at offset 0

#### Scenario: Bone frame count
- **WHEN** a VMD file has 100 bone frames
- **THEN** `vmdDocument.boneFrames.length` SHALL be `100`

#### Scenario: Bezier interpolation data
- **WHEN** a bone frame is parsed
- **THEN** `frame.interpolation` SHALL be a `4×4×4` byte array (Bezier curve control points for X/Y/Z/R)

#### Scenario: Morph (face) frame
- **WHEN** a VMD file has morph keyframes
- **THEN** each `VmdMorphFrame` SHALL have `name: string`, `frame: number`, `weight: number` (0.0–1.0)

### Requirement: MMD importer (DOM → AiScene IR)
`nexus-mmd` SHALL provide an `MMDImporter` that implements `BaseImporter`, detects PMX/PMD/VMD by magic bytes, converts the corresponding DOM to a valid `AiScene`, and maps MMD-specific data to the IR.

#### Scenario: PMX materials to AiMaterial
- **WHEN** a PMX file with 3 materials is imported
- **THEN** `scene.materials` SHALL have 3 `AiMaterial` entries; each SHALL include properties for diffuse color, specular color, ambient color, edge color, and texture file path

#### Scenario: PMX bones to AiNode hierarchy
- **WHEN** a PMX file has a bone hierarchy
- **THEN** `scene.rootNode` SHALL contain an `AiNode` subtree mirroring the bone parent-child relationships

#### Scenario: PMX morphs preserved as AiMeshMorphAnim channels
- **WHEN** a PMX file has vertex morphs
- **THEN** each morph SHALL be stored as an `AiAnimMesh` in `mesh.morphTargets` with the morph name

#### Scenario: VMD merged with PMX model
- **WHEN** `MMDImporter.read` is called with a PMX buffer AND a companion VMD buffer via `ImportSettings.motionBuffer`
- **THEN** the resulting `scene.animations` SHALL contain the VMD keyframe data mapped to the PMX bone names

#### Scenario: MMD-specific metadata preserved
- **WHEN** a PMX file with rigid bodies is imported
- **THEN** rigid body data SHALL be stored in `scene.metadata["mmd:rigidBodies"]` for consumers that need physics

### Requirement: MMD exporter (AiScene IR → PMX/VMD binary)
`nexus-mmd` SHALL provide an `MMDExporter` that implements `BaseExporter`, serialising an `AiScene` back to PMX 2.0 binary or VMD binary depending on `ExportSettings.format`.

#### Scenario: PMX round-trip vertex count
- **WHEN** a PMX file is imported and re-exported as PMX
- **THEN** the re-exported file's vertex count SHALL equal the original

#### Scenario: VMD export from animation
- **WHEN** `write(scene, { format: "vmd" })` is called on a scene with one `AiAnimation`
- **THEN** the output SHALL be a valid VMD binary with the correct magic header and bone frame count

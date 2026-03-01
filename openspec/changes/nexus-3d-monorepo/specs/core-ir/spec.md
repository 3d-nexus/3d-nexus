## ADDED Requirements

### Requirement: AiScene root container
The `nexus-core` package SHALL export an `AiScene` interface that is the root container for all imported 3D data, containing `rootNode`, `meshes`, `materials`, `animations`, `textures`, `lights`, `cameras`, `metadata`, and a bitfield `flags`.

#### Scenario: Scene holds all sub-arrays
- **WHEN** a format importer produces an `AiScene`
- **THEN** all arrays (`meshes`, `materials`, `animations`, `textures`, `lights`, `cameras`) MUST be present (empty array if unused, never `undefined`)

#### Scenario: Scene flags encode completeness
- **WHEN** a scene has no mesh data
- **THEN** `flags` SHALL include `AI_SCENE_FLAGS_INCOMPLETE` (bit 0)

### Requirement: AiNode scene hierarchy
The package SHALL export an `AiNode` interface with `name: string`, `transformation: AiMatrix4x4`, `parent: AiNode | null`, `children: AiNode[]`, `meshIndices: number[]`, and optional `metadata: AiMetadata | null`.

#### Scenario: Root node has null parent
- **WHEN** a scene is created
- **THEN** `scene.rootNode.parent` SHALL be `null`

#### Scenario: Child nodes reference parent
- **WHEN** a child node is attached
- **THEN** `child.parent` SHALL equal the parent node object

### Requirement: AiMesh geometry container
The package SHALL export an `AiMesh` interface containing `name`, `primitiveTypes`, `vertices`, `normals`, `tangents`, `bitangents`, `textureCoords` (array of 8 slots), `colors` (array of 8 slots), `faces`, `bones`, `materialIndex`, `morphTargets`, and `aabb`.

#### Scenario: Empty channels are null
- **WHEN** a mesh has no normals
- **THEN** `mesh.normals` SHALL be an empty array `[]`

#### Scenario: UV channel slots
- **WHEN** a mesh has UV channel 0 only
- **THEN** `mesh.textureCoords[0]` SHALL be an `AiVector3D[]` and `mesh.textureCoords[1..7]` SHALL be `null`

### Requirement: AiFace polygon face
The package SHALL export an `AiFace` interface with `indices: number[]` representing vertex index references into the parent mesh's vertex array.

#### Scenario: Triangle face
- **WHEN** an OBJ face line `f 1 2 3` is imported
- **THEN** the resulting `AiFace.indices` SHALL be `[0, 1, 2]` (0-based)

#### Scenario: Quad face
- **WHEN** an FBX quad polygon is imported without triangulation
- **THEN** `AiFace.indices` SHALL have length 4

### Requirement: AiBone skeletal bone
The package SHALL export an `AiBone` interface with `name: string`, `weights: AiVertexWeight[]`, `offsetMatrix: AiMatrix4x4`, and optional `node: AiNode | null` (resolved post-import).

#### Scenario: Weight sum
- **WHEN** a skinned vertex is referenced by bones
- **THEN** the sum of all `AiVertexWeight.weight` values for that vertex SHOULD equal 1.0 (normalized)

### Requirement: AiMaterial property table
The package SHALL export `AiMaterial` with `name: string` and `properties: AiMaterialProperty[]`. Each property SHALL have `key: string` (assimp material key convention, e.g. `"$clr.diffuse"`), `semantic: AiTextureType`, `index: number`, `type: AiPropertyTypeInfo`, and `data: unknown`.

#### Scenario: Get diffuse color
- **WHEN** a material property with key `"$clr.diffuse"` is present
- **THEN** `property.data` SHALL be an `AiColor4D` with `r`, `g`, `b`, `a` fields

#### Scenario: Get diffuse texture path
- **WHEN** a material has a diffuse texture map
- **THEN** a property with `key = "$tex.file"` and `semantic = AiTextureType.DIFFUSE` SHALL be present with `data` as a `string` (file path or embedded texture `"*0"` reference)

### Requirement: AiAnimation and keyframe channels
The package SHALL export `AiAnimation` with `name`, `duration`, `ticksPerSecond`, `channels: AiNodeAnim[]`, `meshChannels: AiMeshAnim[]`, and `morphMeshChannels: AiMeshMorphAnim[]`.
`AiNodeAnim` SHALL have `positionKeys: AiVectorKey[]`, `rotationKeys: AiQuatKey[]`, `scalingKeys: AiVectorKey[]`, `preState: AiAnimBehaviour`, `postState: AiAnimBehaviour`.

#### Scenario: Animation ticks
- **WHEN** a VMD animation is imported
- **THEN** `animation.ticksPerSecond` SHALL be 30 (VMD frame rate)

#### Scenario: Empty channels allowed
- **WHEN** a bone has only rotation keyframes
- **THEN** `nodeAnim.positionKeys` MAY be empty and `nodeAnim.rotationKeys` SHALL have at least one entry

### Requirement: AiTexture embedded texture
The package SHALL export `AiTexture` with `filename: string`, `width: number`, `height: number` (0 if compressed), `formatHint: string` (e.g. `"png"`), and `data: Uint8Array`.

#### Scenario: Compressed embedded texture
- **WHEN** an FBX file embeds a PNG texture
- **THEN** `texture.height` SHALL be `0`, `texture.width` SHALL be the byte length of `texture.data`, and `texture.formatHint` SHALL be `"png"`

### Requirement: Math primitive types
The package SHALL export `AiVector2D`, `AiVector3D`, `AiColor3D`, `AiColor4D`, `AiQuaternion`, `AiMatrix3x3`, `AiMatrix4x4` (column-major, `data: Float32Array`), and `AiAABB` as TypeScript interfaces.

#### Scenario: Identity matrix
- **WHEN** `createIdentityMatrix4x4()` utility is called
- **THEN** the returned `AiMatrix4x4.data` SHALL equal a 16-element Float32Array representing the 4×4 identity matrix

### Requirement: BaseImporter and BaseExporter interfaces
The package SHALL export a `BaseImporter` interface with `canRead(buffer: ArrayBuffer, filename: string): boolean` and `read(buffer: ArrayBuffer, filename: string, settings?: ImportSettings): AiScene`; and a `BaseExporter` interface with `getSupportedExtensions(): string[]` and `write(scene: AiScene, settings?: ExportSettings): ArrayBuffer`.

#### Scenario: canRead returns false for wrong format
- **WHEN** an OBJ importer's `canRead` is called with a binary FBX buffer
- **THEN** it SHALL return `false`

#### Scenario: Exporter returns ArrayBuffer
- **WHEN** `exporter.write(scene)` is called with a valid `AiScene`
- **THEN** the return value SHALL be a non-empty `ArrayBuffer`

### Requirement: AiMetadata key-value store
The package SHALL export `AiMetadata` as `Record<string, AiMetadataEntry>` where `AiMetadataEntry` has `type: AiMetadataType` and `data: unknown`.

#### Scenario: String metadata
- **WHEN** a metadata entry is stored with type `AI_AISTRING`
- **THEN** `entry.data` SHALL be a `string`

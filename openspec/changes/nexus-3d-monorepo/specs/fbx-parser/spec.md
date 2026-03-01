## ADDED Requirements

### Requirement: FBX binary tokeniser
`nexus-fbx` SHALL provide an `FBXBinaryTokenizer` that reads the binary FBX `ArrayBuffer`, verifies the 23-byte header magic (`"Kaydara FBX Binary  \x00\x1a\x00"`), and emits a flat list of `FBXToken` objects (type: NodeBegin / NodeEnd / Data). Compressed property arrays SHALL be decompressed using `fflate` inflate before tokenisation.

#### Scenario: Magic header validation
- **WHEN** `FBXBinaryTokenizer.tokenize` is called on an FBX binary buffer
- **THEN** it SHALL verify bytes 0–22 match the Kaydara magic and throw `ParseError` otherwise

#### Scenario: Compressed array decompression
- **WHEN** an FBX property array has encoding flag `1` (deflate)
- **THEN** `fflate.inflateSync` SHALL be used to decompress the data before storing in the token

#### Scenario: 64-bit node record offsets (FBX 7.5+)
- **WHEN** the FBX version is >= 7500
- **THEN** node record offsets SHALL be read as `DataView.getBigUint64` (8 bytes) instead of `getUint32` (4 bytes)

### Requirement: FBX ASCII tokeniser
`nexus-fbx` SHALL provide an `FBXAsciiTokenizer` that reads a string representation of an ASCII FBX file and emits equivalent `FBXToken` objects. ASCII FBX uses a `NodeName: { ... }` block syntax with colon-separated property lines.

#### Scenario: ASCII node open
- **WHEN** a line is `Objects:  {`
- **THEN** a `NodeBegin` token with name `"Objects"` SHALL be emitted

#### Scenario: ASCII string property
- **WHEN** a property line contains `"C++\nMyString"`
- **THEN** the string value SHALL be unescaped and stored correctly

### Requirement: FBX DOM (Document Object Model)
`nexus-fbx` SHALL provide an `FbxDocument` class that consumes the token stream and constructs a lazy-parsed object graph of `FbxObject` subtypes: `FbxGeometry` (mesh), `FbxMaterial`, `FbxTexture`, `FbxAnimationStack`, `FbxAnimationLayer`, `FbxAnimationCurveNode`, `FbxAnimationCurve`, `FbxDeformer` (Skin / Cluster / BlendShape / BlendShapeChannel), `FbxNodeAttribute`, `FbxModel` (node).

#### Scenario: Lazy object resolution
- **WHEN** an `FbxDocument` is built from a large FBX
- **THEN** `FbxDocument.objects` SHALL be a `Map<bigint, LazyFbxObject>` that parses the sub-tree only on first access

#### Scenario: Connection graph
- **WHEN** the FBX `Connections` section is parsed
- **THEN** `FbxDocument.connections` SHALL allow querying parent → children and child → parent by object UID

#### Scenario: PropertyTable access
- **WHEN** an FBX object has a `Properties70` block
- **THEN** `FbxObject.properties.get("ShadingModel")` SHALL return the typed property value

### Requirement: FBX converter (DOM → AiScene IR)
`nexus-fbx` SHALL provide an `FBXConverter` that traverses the `FbxDocument` object graph and constructs a valid `AiScene`, performing coordinate-system normalisation and unit conversion.

#### Scenario: Coordinate system normalisation
- **WHEN** the FBX `GlobalSettings` specifies a Y-up right-handed coordinate system with FrontAxis=ParityEven
- **THEN** the importer SHALL apply the appropriate axis-swap matrix so that the resulting IR uses Y-up right-handed conventions

#### Scenario: Geometry to AiMesh
- **WHEN** an `FbxGeometry` with `LayerElementNormal`, `LayerElementUV`, and face index arrays is converted
- **THEN** the resulting `AiMesh` SHALL have `normals`, `textureCoords[0]`, and `faces` arrays of the correct length

#### Scenario: Skin cluster to AiBone
- **WHEN** an `FbxDeformer` of type `Skin` with child `Cluster` deformers is present
- **THEN** each `Cluster` SHALL produce one `AiBone` with the correct `offsetMatrix` and `weights`

#### Scenario: BlendShape to AiAnimMesh
- **WHEN** an `FbxDeformer` of type `BlendShape` is attached to a geometry
- **THEN** each `BlendShapeChannel` SHALL produce one `AiAnimMesh` morph target on the resulting `AiMesh`

#### Scenario: AnimationStack to AiAnimation
- **WHEN** an `FbxAnimationStack` contains multiple layers and curve nodes
- **WHEN** the stack is converted
- **THEN** one `AiAnimation` SHALL be produced per stack, with one `AiNodeAnim` per connected `FbxModel`

### Requirement: FBX importer
`nexus-fbx` SHALL provide an `FBXImporter` that implements `BaseImporter`, auto-detects ASCII vs binary FBX by the magic header, delegates to the appropriate tokeniser, builds the `FbxDocument`, and calls `FBXConverter` to produce the final `AiScene`.

#### Scenario: canRead binary FBX
- **WHEN** `canRead` is called with an FBX binary buffer
- **THEN** it SHALL return `true` for a `.fbx` filename and a buffer that starts with the Kaydara magic bytes

#### Scenario: canRead ASCII FBX
- **WHEN** the buffer does NOT start with the Kaydara magic
- **THEN** the importer SHALL assume ASCII mode and attempt tokenisation

### Requirement: FBX exporter (AiScene IR → FBX ASCII)
`nexus-fbx` SHALL provide an `FBXExporter` that implements `BaseExporter`, serialising an `AiScene` to FBX 7.4 ASCII text format as an `ArrayBuffer` of UTF-8 bytes.

#### Scenario: FBX header written
- **WHEN** `write(scene)` is called
- **THEN** the output SHALL begin with the FBX ASCII header comment lines including version `7400`

#### Scenario: Geometry export
- **WHEN** a scene contains one `AiMesh` with 3 vertices and 1 triangular face
- **THEN** the exported FBX SHALL contain a `Geometry` node with `Vertices`, `PolygonVertexIndex`, and correctly negated last index per polygon (FBX convention)

#### Scenario: Material export
- **WHEN** a scene has an `AiMaterial` with a diffuse color property
- **THEN** the exported FBX SHALL contain a `Material` node with a `Properties70` block including the `DiffuseColor` property

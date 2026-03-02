# fbx-textures-materials Specification

## Purpose
TBD - created by archiving change pmx-fbx-industrial-grade. Update Purpose after archive.
## Requirements
### Requirement: Full FBX material Properties70 extraction
The `FBXConverter` SHALL extract all recognized properties from FBX `Material` node `Properties70` blocks and store them as `AiMaterialProperty` entries using assimp key conventions:

| FBX Property | AiMaterialProperty key | Type |
|---|---|---|
| `DiffuseColor` | `$clr.diffuse` | AiColor4D (a=1) |
| `SpecularColor` | `$clr.specular` | AiColor3D |
| `AmbientColor` | `$clr.ambient` | AiColor3D |
| `EmissiveColor` | `$clr.emissive` | AiColor3D |
| `Shininess` / `ShininessExponent` | `$mat.shininess` | float |
| `Opacity` / `TransparencyFactor` | `$mat.opacity` | float (1 - TransparencyFactor) |
| `BumpFactor` | `$mat.bumpscaling` | float |
| `ReflectionFactor` | `$mat.reflectivity` | float |
| `Maya|roughness` / `Roughness` | `$mat.roughnessFactor` | float |
| `Maya|metalness` / `Metalness` | `$mat.metallicFactor` | float |

#### Scenario: Diffuse color extracted
- **WHEN** a Material Properties70 contains `P: "DiffuseColor","Color","",A,0.8,0.6,0.4`
- **THEN** the `AiMaterial` SHALL have a property `{ key:"$clr.diffuse", data:{r:0.8,g:0.6,b:0.4,a:1.0} }`

#### Scenario: Opacity inverted from TransparencyFactor
- **WHEN** a Material has `TransparencyFactor = 0.3`
- **THEN** `$mat.opacity` SHALL be `0.7` (= 1 - 0.3)

#### Scenario: PBR roughness extracted
- **WHEN** a Material has `Maya|roughness = 0.5`
- **THEN** the property `$mat.roughnessFactor` SHALL have `data = 0.5`

### Requirement: FBX texture connection to material property
The `FBXConverter` SHALL resolve `Texture` objects connected to `Material` objects via the connection graph. The texture's `RelativeFilename` property SHALL be stored as an `AiMaterialProperty` with `key = "$tex.file"`, `semantic` = the mapped `AiTextureType` (based on the connection property string: `DiffuseColor`→DIFFUSE, `NormalMap`→NORMALS, `SpecularColor`→SPECULAR, `EmissiveColor`→EMISSIVE, etc.).

#### Scenario: Diffuse texture property created
- **WHEN** a Material has a Texture child connected via `DiffuseColor`
- **THEN** `AiMaterial.properties` SHALL contain `{ key:"$tex.file", semantic: AiTextureType.DIFFUSE, data: "textures/diffuse.png" }`

#### Scenario: Normal map texture property
- **WHEN** a Texture is connected to a Material via `NormalMap`
- **THEN** the property SHALL have `semantic = AiTextureType.NORMALS`

### Requirement: Embedded Video texture extraction
The `FBXConverter` SHALL extract `FbxVideo` nodes that have a `Content` binary property (the embedded file blob). Each such Video SHALL produce one `AiTexture` entry in `scene.textures[]`:
- `filename` = `RelativeFilename` property value
- `width` = byte length of Content blob
- `height = 0` (compressed/raw blob)
- `formatHint` = file extension of filename (e.g. `"png"`, `"jpg"`)
- `data` = the Content blob as `Uint8Array`

Material texture properties referencing the same filename SHALL use the embedded texture reference format `"*N"` (where N is the index in `scene.textures[]`).

#### Scenario: Embedded texture added to scene
- **WHEN** an FBX has a Video node with Content (embedded PNG)
- **THEN** `scene.textures.length` SHALL be at least 1 and `textures[0].data.length > 0`

#### Scenario: Material references embedded texture
- **WHEN** a material's Texture RelativeFilename matches an embedded Video filename
- **THEN** `AiMaterialProperty.data` SHALL be `"*0"` (or `"*N"` for the N-th texture)

### Requirement: Multi-UV layer extraction (LayerElementUV[0..7])
The `FBXConverter` SHALL extract all `LayerElementUV` layers present on a Geometry (indices 0 through 7) and map each to `AiMesh.textureCoords[N]`. Layers beyond index 7 SHALL be ignored. Each UV layer SHALL be expanded from its `MappingInformationType` (ByPolygonVertex / ByVertex / ByPolygon / AllSame) into a per-vertex dense array.

#### Scenario: Second UV channel populated
- **WHEN** a Geometry has LayerElementUV at indices 0 and 1
- **THEN** `mesh.textureCoords[0]` and `mesh.textureCoords[1]` SHALL both be non-null arrays of the same length as `mesh.vertices`

#### Scenario: Single UV layer leaves slots null
- **WHEN** a Geometry has only one LayerElementUV
- **THEN** `mesh.textureCoords[1..7]` SHALL all be `null`

### Requirement: FBX exporter writes material Properties70 and Video nodes
The `FBXExporter` SHALL write per-material `Properties70` blocks for all `AiMaterialProperty` entries, converting keys back to FBX property names. For each `AiTexture` in `scene.textures[]`, it SHALL write a `Video` node with `Content` binary property. Material texture `"$tex.file"` properties with `"*N"` values SHALL be resolved back to the corresponding Video filename.

#### Scenario: Material diffuse color written
- **WHEN** `AiMaterial` has `$clr.diffuse = {r:1,g:0,b:0,a:1}`
- **THEN** the exported FBX Material SHALL contain `P: "DiffuseColor","Color","",A,1,0,0`

#### Scenario: Embedded texture Video node written
- **WHEN** `scene.textures[0]` has a 1024-byte PNG blob
- **THEN** the exported FBX SHALL contain a `Video` node with `Content: *1024 { … }`


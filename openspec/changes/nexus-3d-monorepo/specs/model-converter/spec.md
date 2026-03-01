## ADDED Requirements

### Requirement: ModelConverter cross-format conversion pipeline
`nexus-converter` SHALL export a `ModelConverter` class with a `convert(input: ArrayBuffer, fromFormat: ModelFormat, toFormat: ModelFormat, options?: ConvertOptions): ArrayBuffer` method that routes the input through the appropriate importer, optional post-processing steps, and the appropriate exporter to produce the output.

#### Scenario: OBJ to PMX conversion
- **WHEN** `convert(objBuffer, "obj", "pmx")` is called
- **THEN** the returned `ArrayBuffer` SHALL be a valid PMX 2.0 binary that begins with `PMX `

#### Scenario: PMX to OBJ conversion
- **WHEN** `convert(pmxBuffer, "pmx", "obj")` is called
- **THEN** the returned `ArrayBuffer` SHALL be a valid OBJ text file containing at least one `v ` line

#### Scenario: FBX to OBJ conversion
- **WHEN** `convert(fbxBuffer, "fbx", "obj")` is called
- **THEN** vertex count in the output OBJ SHALL match the vertex count in the FBX mesh (within triangulation expansion)

#### Scenario: Unknown format throws
- **WHEN** `convert` is called with an unsupported `fromFormat`
- **THEN** it SHALL throw a `ConversionError` with a descriptive message

### Requirement: Supported format enum
`nexus-converter` SHALL export a `ModelFormat` union type (or const enum) covering `"obj"`, `"fbx"`, `"pmx"`, `"pmd"`, `"vmd"`.

#### Scenario: Format enum completeness
- **WHEN** the consumer passes `ModelFormat.OBJ`
- **THEN** it SHALL equal the string `"obj"`

### Requirement: Post-processing pipeline
`nexus-converter` SHALL export a `PostProcessStep` interface with `process(scene: AiScene): AiScene` and the following built-in implementations: `TriangulateStep`, `GenerateNormalsStep`, `FlipUVsStep`, `SortByPTypeStep`, `OptimizeMeshesStep`.

#### Scenario: Triangulate converts quads
- **WHEN** `TriangulateStep.process` is called on a scene containing one `AiMesh` with quad faces (`AiFace.indices.length === 4`)
- **THEN** every face in the output SHALL have `indices.length === 3`

#### Scenario: GenerateNormals produces unit normals
- **WHEN** `GenerateNormalsStep.process` is called on a scene where `mesh.normals` is empty
- **THEN** `mesh.normals` SHALL be populated with one `AiVector3D` per vertex, each of magnitude 1.0

#### Scenario: FlipUVs inverts V channel
- **WHEN** `FlipUVsStep.process` is called on a mesh with UV `(u, v)`
- **THEN** each UV SHALL become `(u, 1 - v)`

#### Scenario: Post-processing applied during conversion
- **WHEN** `ConvertOptions.postProcess` includes `TriangulateStep`
- **THEN** the `convert` output SHALL contain only triangular faces regardless of the source format

### Requirement: ConvertOptions configuration
`nexus-converter` SHALL export `ConvertOptions` with fields: `postProcess?: PostProcessStep[]`, `importSettings?: ImportSettings`, `exportSettings?: ExportSettings`.

#### Scenario: No post-processing by default
- **WHEN** `convert` is called without `ConvertOptions`
- **THEN** no post-processing steps SHALL be applied; the output SHALL be a direct format-to-format conversion

### Requirement: ImportResult with warnings
All importers accessed via `nexus-converter` SHALL return an `ImportResult` wrapper with `scene: AiScene` and `warnings: ImportWarning[]`, where `ImportWarning` has `code: string`, `message: string`, and optional `context: unknown`.

#### Scenario: Warning on missing MTL
- **WHEN** an OBJ file references an MTL file but none is provided
- **THEN** `result.warnings` SHALL contain at least one entry with `code === "MISSING_MTL_FILE"`

#### Scenario: Warning on unknown VMD bone
- **WHEN** a VMD animation references a bone name not present in the companion PMX model
- **THEN** `result.warnings` SHALL contain an entry with `code === "VMD_BONE_NOT_FOUND"`

### Requirement: Monorepo workspace scaffold
The project root SHALL contain a `package.json` with `"workspaces": ["packages/*", "apps/*"]`, a `pnpm-workspace.yaml`, a `tsconfig.base.json` with strict mode and path aliases, and a `vite.config.base.ts` that each package extends.

#### Scenario: Cross-package workspace reference
- **WHEN** `nexus-obj`'s `package.json` lists `"nexus-core": "workspace:*"` as a dependency
- **THEN** pnpm SHALL resolve it to the local `packages/nexus-core` package without publishing

#### Scenario: TypeScript strict mode
- **WHEN** any package is compiled
- **THEN** it SHALL compile with `"strict": true`, `"noUncheckedIndexedAccess": true`, and `"exactOptionalPropertyTypes": true` without errors

### Requirement: Per-package Vite library build
Each package (`nexus-core`, `nexus-obj`, `nexus-mmd`, `nexus-fbx`, `nexus-converter`) SHALL have a `vite.config.ts` with `build.lib` targeting `src/index.ts`, producing `dist/index.js` (ESM) and `dist/index.d.ts` via `vite-plugin-dts`.

#### Scenario: ESM output
- **WHEN** `vite build` is run inside `packages/nexus-core`
- **THEN** `dist/index.js` SHALL contain `export` statements (ESM format)

#### Scenario: Type declarations emitted
- **WHEN** `vite build` is run inside any package
- **THEN** `dist/index.d.ts` SHALL be generated and contain exported interface definitions

### Requirement: Vitest unit test suite per package
Each package SHALL include a `vitest.config.ts` and a `src/__tests__/` directory. Tests SHALL cover parser round-trips using binary/text fixtures committed under `packages/<pkg>/fixtures/`.

#### Scenario: OBJ round-trip test
- **WHEN** `vitest run` is executed in `nexus-obj`
- **THEN** a test SHALL parse a fixture OBJ file and assert vertex/face counts match expected values

#### Scenario: PMX parse test
- **WHEN** `vitest run` is executed in `nexus-mmd`
- **THEN** a test SHALL parse a fixture PMX binary and assert bone count and material count match expected values

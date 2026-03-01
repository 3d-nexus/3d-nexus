## Context

The project targets browser-only environments where there is no file system access, no native binary addon support, and strict bundle-size budgets. The reference implementation is Autodesk's open-source **assimp** C++ library (`code/AssetLib/`), which organises each format family into a dedicated subdirectory containing a tokeniser, parser, in-memory DOM, importer (DOM → IR), and exporter (IR → DOM → bytes). This project mirrors that layered architecture in TypeScript, replacing C++ streams with `ArrayBuffer` / `DataView` / `TextDecoder` browser APIs.

The monorepo root lives at `C:\Workspace\Coding\nexus-3d` and will use **pnpm workspaces** to manage five library packages (`nexus-core`, `nexus-obj`, `nexus-mmd`, `nexus-fbx`, `nexus-converter`) and one app (`apps/playground`). Each library is built independently with **Vite library mode** + **vite-plugin-dts** and published as an ESM bundle with full TypeScript declaration files.

## Goals / Non-Goals

**Goals:**
- Implement a browser-native TS monorepo that parses and writes OBJ/MTL, FBX (ASCII + binary 7.x), and MMD (PMX 2.x, PMD, VMD) model formats.
- Expose a single unified Intermediate Representation (IR) in `nexus-core` that all format packages import — architecture mirrors assimp's `aiScene` / `aiMesh` / `aiMaterial` / `aiAnimation` hierarchy.
- Enable lossless round-trips and cross-format conversions via `nexus-converter`.
- Zero runtime dependencies beyond `fflate` (binary FBX zlib) and a `TextDecoder`-based Shift_JIS/UTF-16 helper for MMD Japanese strings.
- Strict TypeScript throughout; each package builds independently.

**Non-Goals:**
- Node.js / server-side support (no `fs`, no `Buffer`).
- WebGL rendering or scene graph integration.
- Formats beyond OBJ, FBX, PMX/PMD/VMD in this change.
- Post-processing steps that require GPU (skinning bake-down, normal map generation).
- WASM bindings or C++ interop.

## Decisions

### D1 — Monorepo tool: pnpm workspaces (not Nx / Turborepo)
**Decision**: Use plain pnpm workspaces with a shared `tsconfig.base.json` and per-package `vite.config.ts`.
**Rationale**: Zero extra tooling overhead; workspaces natively handle cross-package `workspace:*` references. Turborepo/Nx adds caching value at scale but is premature for five small packages.
**Alternative considered**: Turborepo — adds caching but requires its own config layer and a learning curve not worth adding here.

### D2 — IR design: mirror assimp's aiScene hierarchy verbatim in TS interfaces
**Decision**: Define `AiScene`, `AiNode`, `AiMesh`, `AiFace`, `AiBone`, `AiMaterial`, `AiAnimation`, `AiNodeAnim`, `AiMeshMorphAnim`, `AiTexture`, `AiLight`, `AiCamera` as plain TypeScript interfaces in `nexus-core`. Math types (`AiVector3D`, `AiMatrix4x4`, `AiQuaternion`) are plain objects (not classes) for zero-overhead serialisation.
**Rationale**: 1:1 naming with assimp minimises translation friction when consulting assimp source for protocol details. Plain interfaces are tree-shakeable and have no runtime cost.
**Alternative considered**: Three.js-flavoured scene graph — incompatible naming / semantics; would require a re-mapping layer when reading the assimp spec.

### D3 — Binary parsing: DataView over typed array slicing
**Decision**: All binary format parsers (FBX binary, PMX, PMD, VMD) use a thin `BinaryReader` wrapper around `DataView` with an advancing cursor, little-endian by default.
**Rationale**: `DataView` handles unaligned reads and mixed-endian fields cleanly (FBX uses both). Direct typed-array slicing requires careful stride math and is error-prone for variable-length fields.
**Alternative considered**: `Buffer` (Node.js) — unavailable in browser; ruled out.

### D4 — FBX binary decompression: fflate (not pako / zlib.js)
**Decision**: Use `fflate` for deflate decompression of compressed FBX property arrays.
**Rationale**: `fflate` is the fastest pure-JS inflate implementation, is ESM-native, and is tree-shakeable to ~6 KB for inflate-only use. pako is CommonJS-first and ~27 KB.
**Alternative considered**: Native `DecompressionStream` (browser API) — async-only, not available in all target browsers (Safari 16.4+), and complicates synchronous parse flow.

### D5 — OBJ parsing: line-by-line text scan (not regex soup)
**Decision**: `ObjFileParser` reads the text as a string, splits by line, and dispatches on the first token using a `Map<string, handler>` lookup — mirrors assimp's `ObjFileParser.cpp` approach.
**Rationale**: OBJ files can be hundreds of MB; a single-pass line tokeniser avoids materialising large intermediate strings. A regex-heavy approach is harder to maintain and profile.

### D6 — MMD string encoding: TextDecoder with explicit charset
**Decision**: PMX files embed a per-file encoding flag (0 = UTF-16LE, 1 = UTF-8). PMD uses Shift_JIS. `nexus-mmd` uses `TextDecoder` (built-in modern browsers) for UTF-8/UTF-16LE; a small lookup table handles the Shift_JIS subset used in PMD bone/morph names.
**Alternative considered**: `iconv-lite` — CommonJS, 200 KB, not suitable.

### D7 — Package build: Vite library mode (not tsc + rollup separately)
**Decision**: Each package has a `vite.config.ts` with `build.lib` pointing at `src/index.ts`, producing `dist/index.js` (ESM) and `dist/index.d.ts` via `vite-plugin-dts`.
**Rationale**: Vite handles tree-shaking, minification, and type emission in one command. `tsc --emitDeclarationOnly` + rollup is equivalent but requires two config files per package.

### D8 — Internal layering per format package
Each format package follows assimp's layered architecture exactly:
```
Tokenizer  →  Parser  →  DOM (FileData)  →  Importer (DOM→IR)
                                          →  Exporter (IR→DOM→bytes)
```
This means format-specific DOM types (e.g. `ObjModel`, `FbxDocument`, `PmxDocument`) are internal implementation details — only the importer/exporter surfaces are exported from each package's `index.ts`.

### D9 — Coordinate system normalisation in converters
**Decision**: Each importer converts its native coordinate system to assimp's default right-handed Y-up coordinate system during import. FBX uses a metadata-embedded axis descriptor; PMX is Y-up by convention but Z-negated vs. OpenGL. The `nexus-converter` pipeline applies a post-process `CoordinateSystemStep` if required.
**Rationale**: Keeping the IR in a canonical coordinate system means cross-format conversion never needs to reason about the source format's conventions.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| FBX binary format is undocumented (reverse-engineered) | Follow assimp's `FBXBinaryTokenizer.cpp` byte-for-byte; add integration tests against known-good `.fbx` fixtures |
| PMX bone IK chain resolution is complex | Implement IK as metadata in the IR (`AiBone.ikChain`) rather than baking — consumers resolve at render time |
| Large OBJ files (100 MB+) may block the main thread | Expose an async `readAsync(stream: ReadableStream)` variant in `ObjFileImporter` for streaming parse; synchronous `read(buffer)` remains for small files |
| fflate inflate allocates a new Uint8Array per compressed block | Pre-allocate an output buffer sized to FBX property `uncompressedLength` hint to reduce GC pressure |
| Cross-format material mapping loses fidelity (e.g. MMD toon shading has no OBJ equivalent) | Stash format-specific extended properties in `AiMaterial.metadata` under a namespaced key (e.g. `"mmd:toonIndex"`) for round-trip preservation |
| VMD motion data references bone names by string — mismatches silently produce no animation | Emit a structured `ImportWarning` list on `AiScene.metadata["nexus:warnings"]`; expose via `ImportResult.warnings` |

## Migration Plan

This is a greenfield project — no existing code to migrate. Deployment is publish-only:

1. Scaffold monorepo root (`package.json`, `pnpm-workspace.yaml`, shared configs).
2. Build and test packages in dependency order: `nexus-core` → `nexus-obj` → `nexus-mmd` → `nexus-fbx` → `nexus-converter`.
3. Each package passes its Vitest suite before the next is started.
4. `apps/playground` is wired last as a manual integration harness.

No rollback needed (no production deployment in this change).

## Open Questions

- **OQ1**: Should `nexus-fbx` exporter target FBX ASCII 7.4 only, or also binary 7.4? Binary write requires implementing the entire block-node serialisation in TS — defer to a follow-up change if needed.
- **OQ2**: PMX 2.1 (extended soft body / additional UV) vs PMX 2.0 — current scope targets 2.0/2.1 read; write targets 2.0 only.
- **OQ3**: Should `nexus-converter` expose a `Worker`-based async API for large files out of the box, or leave that to the consumer? Decision deferred — export a `ConvertOptions.offload: boolean` hook for future use.

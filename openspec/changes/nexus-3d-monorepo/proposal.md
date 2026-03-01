## Why

There is no browser-native TypeScript library that can parse, write, and cross-convert the three most prevalent 3D model format families (OBJ/MTL, FBX, MMD/PMX/VMD) using a unified intermediate scene representation. Developers building web-based 3D tools must currently rely on either WebAssembly builds of native libraries (heavy, opaque) or incomplete ad-hoc parsers with no interoperability. This project delivers a pure-TypeScript, tree-shakeable monorepo that fills that gap with a well-defined, assimp-aligned IR as the conversion backbone.

## What Changes

- **New**: `nexus-core` package — unified Intermediate Representation (IR) type definitions mirroring assimp's `aiScene`, `aiMesh`, `aiFace`, `aiBone`, `aiMaterial`, `aiAnimation`, `aiTexture`, `aiLight`, `aiCamera`, and math primitives (`AiVector3D`, `AiMatrix4x4`, `AiQuaternion`, etc.). Includes `BaseImporter` and `BaseExporter` interfaces.
- **New**: `nexus-obj` package — OBJ/MTL text-format parser (line-by-line tokeniser, face/vertex/UV/normal/material directive handling), importer (OBJ DOM → IR), and exporter (IR → OBJ/MTL text).
- **New**: `nexus-mmd` package — Binary parsers for PMX 2.x, PMD, and VMD formats including full skinning (BDEF1/2/4, SDEF, QDEF), morphs (vertex/UV/bone/material/group), physics rigid-bodies and joints; importer (PMX/PMD/VMD DOM → IR) and exporter (IR → PMX/VMD binary).
- **New**: `nexus-fbx` package — ASCII and binary FBX tokeniser/parser, lazy-evaluated FBX DOM (`FbxDocument`, `FbxGeometry`, `FbxMaterial`, `FbxAnimationStack`, `FbxSkin`, `FbxBlendShape`), converter (FBX DOM → IR with coordinate-system and unit normalisation), importer, and exporter.
- **New**: `nexus-converter` package — High-level pipeline: source format → IR → target format, plus post-processing steps (triangulate, generateNormals, flipUVs, sortByPType, optimizeMeshes) mirroring assimp's postprocess module.
- **New**: `apps/playground` — Vite browser app for drag-and-drop format testing.
- **New**: Monorepo scaffold (pnpm workspaces, shared `tsconfig.base.json`, shared `vite.config.base.ts`, Vitest).

## Capabilities

### New Capabilities

- `core-ir`: Assimp-aligned unified Intermediate Representation — all scene, mesh, material, animation, texture, light, camera, and math types; base importer/exporter interfaces.
- `obj-parser`: OBJ and MTL text format parsing + writing (OBJ DOM ↔ AiScene IR).
- `mmd-parser`: PMX / PMD / VMD binary format parsing + writing (MMD DOM ↔ AiScene IR).
- `fbx-parser`: FBX ASCII and binary format parsing + writing (FBX DOM ↔ AiScene IR).
- `model-converter`: Cross-format conversion pipeline and post-processing steps built on top of all parsers and the core IR.

### Modified Capabilities

## Impact

- **New packages**: `nexus-core`, `nexus-obj`, `nexus-mmd`, `nexus-fbx`, `nexus-converter` (each published as independent ESM library).
- **New app**: `apps/playground` (dev-only, not published).
- **Runtime dependencies**: `fflate` (zlib decompression for binary FBX, browser-safe); `text-encoding` polyfill (Shift_JIS / UTF-16 for MMD Japanese strings).
- **Dev toolchain**: pnpm workspaces, Vite + `vite-plugin-dts`, Vitest, TypeScript strict mode.
- **No server-side code**: all packages target the browser `ArrayBuffer` / `DataView` API only — no Node.js `fs` or `Buffer` usage.

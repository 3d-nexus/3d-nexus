## Context

The repository already defines an intermediate representation and baseline FBX/PMX import/export behavior, but those requirements were written around minimal correctness and repo-local fixtures. Industrial DCC interoperability needs a different bar: transforms must survive tool-specific pivot semantics, material graphs need deterministic fallbacks, and every unsupported construct must become explicit metadata or compatibility diagnostics rather than silent loss.

The change crosses multiple packages and requires a shared validation strategy. It also needs fixture governance because compatibility claims are only meaningful when tied to known tool versions and repeatable acceptance tests.

## Goals / Non-Goals

**Goals:**
- Make FBX and PMX behavior explicit enough to claim a compatibility matrix across major DCC and runtime tools.
- Separate canonical IR normalization from source-format fidelity preservation so downstream tools can choose exact round-trip or normalized interchange behavior.
- Add structured diagnostics and reports for unsupported or degraded semantics.
- Build repeatable fixture-based validation for import, export, and cross-format conversion.

**Non-Goals:**
- Implement arbitrary vendor shader graphs or every proprietary extension field bit-for-bit.
- Guarantee visual identity for renderer-specific shading models beyond the documented fallback mappings.
- Ship heavyweight production assets in-repo; fixtures will stay minimal but representative.
- Replace the existing IR with a DCC-specific scene graph.

## Decisions

### Decision: Introduce compatibility profiles and fixture manifests

We will define named profiles for MMD, Blender FBX, Maya FBX, 3ds Max FBX, MotionBuilder FBX, Unity import/export, and Unreal import/export expectations. Each profile will reference canonical fixtures, required semantics, acceptable degradation, and test tolerances.

Alternative considered: rely on one generic fixture suite.
Why not: a single generic suite cannot express tool-specific pivot, interpolation, or material behavior, so it encourages ambiguous pass/fail outcomes.

### Decision: Split normalization from fidelity preservation

Importer/exporter code will continue to normalize into the nexus IR for common consumers, but native semantics that cannot be represented directly will be preserved under namespaced metadata keys such as `fbx:*`, `mmd:*`, and `nexus:compat:*`. Exporters will consult those keys before falling back to normalized defaults.

Alternative considered: expand the IR until every native concept has a first-class field.
Why not: that would overfit the IR to FBX/PMX and make every downstream consumer pay the complexity cost.

### Decision: Treat transform evaluation as a composed stack with audit metadata

FBX transform fidelity will be implemented as an explicit composition pipeline: axis/unit normalization, inherit mode, local TRS, pre/post rotations, rotation pivots, scaling pivots, offsets, and geometric transforms. The evaluated result will populate the IR transform, and the original stack terms will be preserved in metadata for round-trip and diagnostics.

Alternative considered: flatten everything directly to one matrix on import.
Why not: flattening loses the information required for stable re-export and makes DCC-specific bugs impossible to debug.

### Decision: Preserve unsupported semantics as structured diagnostics, not silent drops

Whenever a construct cannot be represented exactly, the pipeline will emit compatibility diagnostics with severity, profile, capability, and fallback action. Tests will assert both data output and expected diagnostic surface.

Alternative considered: best-effort import/export with warnings only in logs.
Why not: logs are not durable test artifacts and cannot drive compatibility claims.

### Decision: Build a matrix-driven validation harness

Validation will run through fixture manifests that declare expected meshes, materials, transforms, animation channels, morph counts, physics blocks, and diagnostics. The harness will support tolerance-based numeric comparison and exact-match comparison where required.

Alternative considered: continue using package-local ad hoc tests only.
Why not: ad hoc tests do not scale across profiles and do not produce a compatibility matrix artifact.

### Decision: Prefer minimal canonical fixtures over large production assets

Fixtures will be hand-authored or generated minimal scenes that isolate one semantic at a time, with optional mirrored exports from external DCC tools captured in manifests. Larger public assets can be referenced later, but the core matrix will remain stable and lightweight.

Alternative considered: base the matrix on a few large reference scenes.
Why not: failures become hard to localize, and repository maintenance cost rises quickly.

## Risks / Trade-offs

- [Risk] Tool-version behavior differs across exporters/importers. -> Mitigation: record tool/version in fixture manifests and scope compatibility claims per profile.
- [Risk] Metadata preservation grows without clear ownership. -> Mitigation: namespace keys by source format and document every persisted field in specs.
- [Risk] Full-fidelity transform handling can regress existing normalized behavior. -> Mitigation: keep normalization tests and add profile-specific regression fixtures for pivot-heavy scenes.
- [Risk] Compatibility expectations may exceed what the current IR can express. -> Mitigation: define explicit degraded modes and require diagnostics rather than blocking the entire pipeline.
- [Risk] Fixture count can explode. -> Mitigation: require each fixture to justify the capability gap it covers and reuse manifests across import/export/converter tests.

## Migration Plan

1. Add fixture manifest infrastructure and compatibility reporting without changing exporter defaults.
2. Expand importer metadata preservation for FBX/PMX semantics that are currently flattened or dropped.
3. Update exporters to consume preserved metadata and emit deterministic diagnostics where fidelity is partial.
4. Roll profile-by-profile through validation, starting with MMD, Blender FBX, and Maya FBX.
5. Tighten defaults in converter and playground flows only after compatibility reports are stable.

Rollback is straightforward because the change is additive at the spec/design layer; implementation can gate stricter behavior behind compatibility-profile-aware code paths until validated.

## Open Questions

- Which external tool versions should be treated as the baseline matrix for Maya, 3ds Max, MotionBuilder, Unity, and Unreal?
- Should compatibility reports be emitted as JSON only, or also as Markdown summaries for CI artifacts?
- Do we want exporter modes for `strict-roundtrip` and `normalized-interchange`, or is one default plus flags sufficient?
- How far should PMX soft body coverage go in-repo if fixture generation requires third-party tools?

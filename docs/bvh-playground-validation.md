# BVH Playground Validation

## Manual Checks

1. Run `pnpm --filter playground dev`.
2. Load `C:\Workspace\Coding\nexus-3d\packages\nexus-bvh\fixtures\minimal.bvh`.
3. Confirm the stats cards show non-zero `Joints`, `Channels`, and `Animations`.
4. Select profile `BVH` and target `FBX`, then convert.
5. Confirm a compatibility report is rendered and the converted file is downloadable.
6. Repeat with `rotation-yzx.bvh` and verify the report still renders without parser errors.

# Changesets

本仓库使用 `changesets` 管理多包版本、发布 PR 和 npm 发布。

## 常用命令

```bash
pnpm changeset
pnpm version-packages
pnpm tag:release
pnpm release
```

## 推荐流程

1. 功能或修复完成后执行 `pnpm changeset`。
2. 选择受影响的 `@3d-nexus/*` 包，并写清楚变更摘要。
3. 合并到 `master` 后，由 GitHub Actions 自动创建版本 PR。
4. 版本 PR 合并后，Actions 会自动发布 npm，并补一个仓库级 tag。

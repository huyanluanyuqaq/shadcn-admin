# HANDOFF-001 — developer → next

> 复制本模板到 `tasks/<state>/<task-id>/handoffs/HANDOFF-<seq>-<from>-to-<to>.md`。
> 替换所有 `{{...}}`。删除本提示块。

---

## Meta

```yaml
From: workbuddy (developer)
To: next
Task: TASK-008 — 邮箱绑定重构与 CI 构建配置修复
Date: 2026-10-10
Current State: DONE
Previous Handoff: 无（首个交接）
```

---

## Completed Work

- 补登 TASK-008 并完成全部验证后提交工作区既有改动（30 修改 / 3 新增 / 1 删除）：
  - 邮箱模块重构为 `email_bindings` 单表（email 唯一 + subscription_id 级联），
    表总数 11 → 10；迁移 `0001_email_bindings.sql` 建新表 → 搬数据 → 删旧表
  - `server/src/lib/crud.ts` 新增唯一约束冲突 → 409 + 中文提示（`uniqueHint`）
  - 前端 `features/emails` 与 `features/subscriptions` 全量改造
  - 构建白名单从 `package.json` 的 `pnpm` 字段迁至 `pnpm-workspace.yaml` 的
    `allowBuilds`；CI 锁定 `pnpm@12.10.1`
  - 修正三处 pnpm 版本事实表述（官方口径：allowBuilds v10.26.0 引入、
    onlyBuiltDependencies v11 移除、本地 10.29.3 仍读旧字段——经本地实证测试确认）

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| 见 TASK-008.md「Changed Files」 | 混合 | 30 修改 / 3 新增 / 1 删除，含本登记文件 |

## Tests

```yaml
命令: pnpm install --frozen-lockfile; pnpm typecheck:server; pnpm exec tsc -b; pnpm exec vite build; pnpm --filter server smoke
结果: 全部通过；smoke 31 通过 / 0 失败
覆盖: shared/server/前端类型与构建；smoke 含邮箱绑定创建、409 重复、400 非法格式、级联删除
未覆盖: 前端浏览器测试（缺 Playwright Chromium）；CI 实跑（本环境无 GitHub Actions）
```

## Known Issues

- CI 是否转绿需推送后观察运行记录（锁版本 + allowBuilds 有文档与本地实测支撑，
  但未经 CI 实证）。
- 旧邮箱数据迁移后 `subscription_id` 留空，需界面补绑（设计如此，已文档化）。

## Remaining Work

- 无（本任务范围内）。

## Assumptions

- 假设 CI 安装的 pnpm 12.10.1 接受 `allowBuilds` 映射语法（官方文档确认该写法
  自 v10.26.0 起可用，且当前文档以 v12 为准）。
- 假设「一任务一提交」的直接 main 提交符合本项目惯例（前 7 个任务均如此）。

## Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| CI 仍报 ERR_PNPM_IGNORED_BUILDS | 发布流程继续红灯 | 按 known-pitfalls §11 store 路径判别法排查；`npx pnpm@12.10.1 install` 本地复现 |
| 迁移 0001 已被他人数据库应用过 | 冲突 | 本仓库为单开发者 fork，迁移随本次提交首次发布 |

## Next Action

推送后查看 GitHub Actions `Continuous Integration` 运行记录，确认
`Install dependencies` 步骤通过（store 路径应为 `store/v11`）。

## References

- 任务定义：`tasks/done/TASK-008-email-bindings-and-ci-build-fix/TASK.md`
- 关联：TASK-007 Known Issues #6（CI 失败归因）
- pnpm 官方设置文档：https://pnpm.io/settings（allowBuilds / strictDepBuilds）

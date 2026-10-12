# TASK-026 — 修复 CI：pnpm test 前构建 @repo/shared

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-026
Title: 修复 CI：pnpm test 前构建 @repo/shared
Workflow: bugfix
Status: REVIEW
Priority: P0
Owner: workbuddy
Owner Since: 2026-10-13
Assigned Role: developer
Created: 2026-10-13
Updated: 2026-10-13
Branch: fix/TASK-026-ci-build-shared-before-test
Requires Human Approval: false
```

---

## Objective

CI `install-lint-build` job 恢复绿色：`pnpm test` 步骤不再因 `@repo/shared`
无法解析而失败，且不削弱既有测试覆盖（含 TASK-025 新增的 server 测试）。

---

## Background

- 触发：push `539d008`（TASK-025 合并）后 CI 失败，上一提交 `292df5d`（TASK-024）通过。
- 失败步骤：`Run tests`（exit code 1），lint / format:check / 浏览器安装均通过。
- 直接根因：TASK-025 首次引入 `server/src/services/notification-format.test.ts`
  （commit `79799ca`），根 vitest 的默认扫描范围从此覆盖 `server/`。
  该测试链路导入 `@repo/shared`，其 package.json exports 指向 `dist/`；
  CI 从未执行 `pnpm build:shared`，`shared/dist` 不存在。
- 级联现象：Vite 依赖扫描失败 → "Skipping dependency pre-bundling" →
  浏览器测试中 React 出现多副本 → 组件测试批量报
  `Invalid hook call`（confirm-dialog 9/9、config-drawer 15/15、
  search-provider 7/8、password-input 1、backups-table 1 失败）。
- 本地不复现原因：本机 `shared/dist` 已存在（曾执行 build:shared / typecheck）。

## Scope

- `.github/workflows/ci.yml`：`Run tests` 前增加 `pnpm build:shared` 步骤。

## Non-Scope

- 不改 vitest include 范围（server 测试进 vitest 是 TASK-025 的既定意图）。
- 不改 `@repo/shared` 的解析方式（不加 alias、不改 exports）。
- 不动 Dockerfile / docker.yml（其构建链已自带 build:shared，CI 绿后另行核对）。

## Acceptance Criteria

- [x] CI 的 test 步骤能在干净环境解析 `@repo/shared`。（ci.yml 新增
      `Build shared package` 步骤，位于 Install dependencies 之后）
- [x] 本地以「无 shared/dist」状态执行 build:shared 后，server 测试与
      原失败组件测试全部通过。（27/27；完整套件 232/232，exit 0）
- [x] `pnpm format:check` 通过（ci.yml 受 prettier 检查）。

## Changed Files

- `.github/workflows/ci.yml`
- `tasks/active/TASK-026-*/TASK.md`（本文件）

## Tests / Verification

- 复现：gh run 38277694007 日志（`Failed to resolve import "@repo/shared"`，
  imported by `server/src/services/notification-format.ts`）。
- 定向验证：移走 shared/dist 模拟 CI 干净态 → `pnpm build:shared` →
  `notification-format.test.ts` + `confirm-dialog.test.tsx` → 27/27 通过。
- 全量回归：`pnpm test` → 19 files / 232 tests 全过，exit 0。
  注：沙箱内首次全量跑曾因 safe-delete 守卫拦截 Vite 优化器临时目录清理
  （78 文件超 50 阈值）而 exit 1，属环境产物；缓存稳定后复跑 exit 0。
  CI（ubuntu runner）无此 shim，不受影响。

## Known Issues

- 无。

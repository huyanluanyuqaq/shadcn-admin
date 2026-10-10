# TASK-008 — 邮箱绑定重构与 CI 构建配置修复

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-008
Title: 邮箱绑定重构与 CI 构建配置修复
Workflow: refactor
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-10
Assigned Role: developer
Created: 2026-10-10
Updated: 2026-10-10
Completed: 2026-10-10
Branch: ""
Requires Human Approval: false
```

> **登记说明（诚实记录）：** 本 Task 的工作成果在登记前已完成并留在工作区未提交
> （见 Background）。本次为**补登**：先完成验证（见 Verification Plan），
> 再登记、提交、归档。所有验证均在补登时真实执行，非事后补写。

---

## Objective

1. 将邮箱模块从「邮箱账号管理」（`email_accounts` + `email_providers` 两张表）
   重构为「邮箱 ↔ 订阅绑定关系」（`email_bindings` 单表），覆盖 schema / 迁移 /
   后端 CRUD / 前端全模块 / API 契约文档。
2. 修复 pnpm 版本漂移导致的 CI 构建失败（`ERR_PNPM_IGNORED_BUILDS`）：
   构建脚本白名单从 `package.json` 的 `pnpm` 字段迁至 `pnpm-workspace.yaml`
   的 `allowBuilds`，并在 CI 锁定 pnpm 版本。

---

## Background

**触发 1（邮箱语义修正，2026-10-10 用户确认）：** 原 `email_accounts` 表存的是
「邮箱账号」（邮箱 + 密码 + 提供商 + 客户），但业务上真正需要管理的是
「某个邮箱地址绑定到哪条订阅」。客户归属由 `subscriptions.customer_id` 承载，
密码 / 提供商字段无业务用途。用户确认后实施重构。

**触发 2（TASK-007 遗留问题 #6）：** CI 自 TASK-005 起长期红灯，
`pnpm install --frozen-lockfile` 报 `ERR_PNPM_IGNORED_BUILDS`。
根因是 CI 用 `npm install -g pnpm`（不锁版本）装到当时最新的 pnpm 12.10.1，
其不再读取 `package.json` 的 `pnpm` 字段，且 `onlyBuiltDependencies` 列表语法
自 pnpm 11 起被移除；而本地 pnpm 10.29.3 仍读旧字段，故本地不复现。
TASK-007 的 Known Issues 已记录修复方向，本 Task 落地。

---

## Scope

- `shared/src/schema/`：`emailBindingInputSchema` / `emailBindingSchema` /
  `emailBindingStatusSchema` 替换账号与提供商两套 schema；
  `poolInputSchema.url` 改为可选（订阅池即机场提供商，落地地址可后补）
- `server/src/db/schema.ts`：删除 `emailProviders` / `emailAccounts`，
  新增 `emailBindings`（email 唯一索引 + subscription_id 级联外键）
- `server/drizzle/0001_email_bindings.sql`：建新表 → 搬数据（subscription_id
  留空）→ 删旧表；`meta/0001_snapshot.json` 与 `_journal.json` 同步
- `server/src/lib/crud.ts`：唯一约束冲突翻译为 409 + 中文提示（`uniqueHint`）
- `server/src/routes/resources.ts`：`/email-bindings` 替换 `/emails` +
  `/email-providers` 两个路由
- `server/src/routes/dashboard.ts`：邮箱统计改查 `email_bindings`
- `server/scripts/smoke.ts`：邮箱绑定用例（创建 / 409 重复 / 400 非法格式 /
  级联删除）
- `src/features/emails/**` 与 `src/features/subscriptions/**`：前端查询 hooks、
  列定义、对话框、批量操作、主按钮全量改造；删除 `email-providers-dialog.tsx`，
  新增 `subscription-providers-dialog.tsx`
- 构建配置：`package.json` 移除 `pnpm` 字段；`pnpm-workspace.yaml` 增加
  `allowBuilds`；`.github/workflows/ci.yml` 锁定 `pnpm@12.10.1`
- 文档：`docs/architecture/overview.md`（10 表模型 + 邮箱语义）、
  `docs/technical/api-contract.md`（6 资源 + EmailBinding 契约）、
  `docs/operations/known-pitfalls.md`（§11 pnpm 版本漂移）、
  `AGENTS.md` §13.6（配置位置与版本事实修正）

## Non-Scope

- 不引入 i18n 框架、不改业务模块既有中文文案
- 不动 `src/components/ui/**` 与 `src/routeTree.gen.ts`
- 不做全量 prettier 格式化（184 文件既存告警，另行处理）
- 不运行前端浏览器测试（需 Playwright Chromium，另行处理）
- 不跟进上游 `satnaing/shadcn-admin` 更新

---

## Requirements

| 类型 | 内容 |
|------|------|
| 功能 | 邮箱模块仅管理「邮箱 ↔ 订阅」绑定：email 唯一、subscription_id 级联删除 |
| 功能 | 重复邮箱提交返回 409 + 中文提示，而非 500 + 原始 SQLite 报文 |
| 功能 | 旧 `email_accounts` 数据迁移时邮箱地址原样保留，subscription_id 留空待界面补绑 |
| 兼容 | `allowBuilds` 写法同时被 pnpm 10.29.3（本地）与 12.10.1（CI）接受 |
| 兼容 | API 路径 `/api/emails`、`/api/email-providers` 不再存在（前端已无引用） |

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | better-sqlite3 版本限定 `^12.4.1`；禁止 `pnpm install --ignore-scripts` |
| 技术 | shared 改动后必须先 `pnpm build:shared` 再 typecheck server |
| 兼容 | 迁移一旦应用不可逆；`0001` 为既有数据库的下一个迁移序号 |
| 安全 | 不存明文密码（新表本就不含 password 列，旧表密码随 DROP TABLE 丢弃） |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-003（业务 CRUD 模块） | blocks | 已完成 |
| TASK-007（全站中文翻译） | 关联（其 Known Issues #6 由本任务触发 2 修复） | 已完成 |

---

## Acceptance Criteria

- [x] AC-1 `shared` 导出 `EmailBinding` / `EmailBindingInput`，不再导出
      `EmailAccount` / `EmailProvider` 相关 schema
- [x] AC-2 `email_bindings` 表：email 唯一索引、subscription_id 外键
      `ON DELETE CASCADE`；表总数 11 → 10
- [x] AC-3 迁移 `0001_email_bindings.sql` 完成「建新表 → 搬数据 → 删旧表」
- [x] AC-4 重复邮箱创建返回 409 且 message 为中文；非法邮箱格式返回 400
- [x] AC-5 删除订阅后其邮箱绑定被级联删除（smoke 验证 404）
- [x] AC-6 `pnpm-workspace.yaml` 含 `allowBuilds`；`package.json` 无 `pnpm` 字段；
      CI 锁定 `pnpm@12.10.1`
- [x] AC-7 `pnpm install --frozen-lockfile`（本地 10.29.3）通过
- [x] AC-8 `pnpm typecheck:server` 与 `pnpm exec tsc -b` 均通过
- [x] AC-9 `pnpm exec vite build` 通过
- [x] AC-10 `pnpm --filter server smoke` 全部通过（含新增邮箱绑定用例）
- [x] AC-11 `docs/` 三份文档与 `AGENTS.md` §13.6 的描述与新实现一致

---

## File Scope

```yaml
File Scope:
  - shared/src/schema/**
  - server/**
  - src/features/emails/**
  - src/features/subscriptions/**
  - docs/**
  - AGENTS.md
  - package.json
  - pnpm-workspace.yaml
  - .github/workflows/ci.yml
  - tasks/done/TASK-008-email-bindings-and-ci-build-fix/**
Non-Scope (files):
  - src/components/ui/**
  - src/routeTree.gen.ts
  - netlify.toml
```

---

## Implementation Plan

1. shared：schema 替换（entities / enums）
2. server：schema.ts 表重构 → drizzle-kit generate 产出 0001 迁移 → CRUD 409 → 路由 → dashboard → smoke 用例
3. 前端：emails / subscriptions 两个 feature 全量改造
4. 构建配置迁移 + CI 锁版本
5. 文档同步（architecture / api-contract / known-pitfalls / AGENTS.md）
6. 验证：install → typecheck → build → smoke

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 | 结果 |
|--------|------|------------|------|
| AC-7 | 命令 | `pnpm install --frozen-lockfile`（pnpm 10.29.3） | ✅ 通过 |
| AC-8 | 命令 | `pnpm typecheck:server` && `pnpm exec tsc -b` | ✅ 均退出码 0 |
| AC-9 | 命令 | `pnpm exec vite build` | ✅ 1.70s 构建成功 |
| AC-10 | 命令 | 起服务后 `pnpm --filter server smoke` | ✅ 31 通过 / 0 失败 |
| AC-4/5 | smoke 用例 | 409 重复绑定 / 400 非法格式 / 删除订阅后绑定 404 | ✅ 全部通过 |
| AC-6 | 人工 | 配置文件内容核对 | ✅ |
| pnpm 版本兼容 | 文档 + 实测 | 官方文档：allowBuilds v10.26.0 引入、onlyBuiltDependencies v11 移除；本地 10.29.3 frozen install 通过 | ✅ |

**冒烟测试覆盖的新增用例（3 条）：** 创建邮箱绑定 / 同一邮箱重复绑定返回 409（非 500）/
非法邮箱格式返回 400；以及既有用例「删除订阅后其邮箱绑定被级联删除」。

---

## Current State

DONE。工作区原有未提交改动（30 改 + 3 增 + 1 删）已完成全部验证并提交。
提交：见 Git 历史（`Refs: TASK-008`）。

---

## Changed Files

共 **34** 个文件（30 修改 / 3 新增 / 1 删除）：

| 类别 | 数量 | 文件 |
|------|------|------|
| 构建配置 | 3 | `package.json`、`pnpm-workspace.yaml`、`.github/workflows/ci.yml` |
| shared | 2 | `shared/src/schema/entities.ts`、`shared/src/schema/enums.ts` |
| server 代码 | 5 | `server/src/db/schema.ts`、`server/src/lib/crud.ts`、`server/src/routes/resources.ts`、`server/src/routes/dashboard.ts`、`server/scripts/smoke.ts` |
| server 迁移 | 3 | `server/drizzle/0001_email_bindings.sql`（新增）、`server/drizzle/meta/0001_snapshot.json`（新增）、`server/drizzle/meta/_journal.json` |
| 前端 emails | 11 | `src/features/emails/**`（含删除 `email-providers-dialog.tsx`） |
| 前端 subscriptions | 3 | `src/features/subscriptions/api.ts`、`subscriptions-primary-buttons.tsx`、`subscription-providers-dialog.tsx`（新增） |
| 文档 | 5 | `AGENTS.md`、`docs/architecture/overview.md`、`docs/technical/api-contract.md`、`docs/operations/known-pitfalls.md` |
| 任务登记 | 1 | 本目录 |

---

## Known Issues

1. **CI 实际运行结果未知** —— 本环境无法执行 GitHub Actions。锁版本 +
   `allowBuilds` 的兼容性有官方文档与本地实测支撑，但 CI 转绿需推送后
   观察运行记录；若仍失败，按 `known-pitfalls.md` §11 的「store 路径判别法」排查。
2. **前端浏览器测试未运行** —— 需 `pnpm test:browser:install` 安装 Playwright
   Chromium；emails 模块改造后其既有测试（如有）未经运行验证。另行处理。
3. **prettier 184 文件既存告警未处理** —— 本任务不做全量格式化，避免无关 diff。另行处理。
4. **迁移的数据语义限制** —— 旧 `email_accounts` 的邮箱地址迁入新表后
   `subscription_id` 留空（旧数据只有 customer_id，无法可靠推断订阅），
   需用户在界面补绑。已在 `docs/architecture/overview.md` 说明。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | developer | — | 2026-10-10 | 补登并提交；验证全绿；遗留 CI 实跑观察 |

**最新 Handoff：** `handoffs/HANDOFF-001-developer-to-next.md`
**Next Action：** 推送后观察 GitHub Actions `Continuous Integration` 是否转绿；
继续处理 TASK-009（工程卫生：格式化 / 测试环境 / 登记文档）。

---

## Task Rules

- [补充] 本任务为补登任务：验证必须先于登记与提交，验证记录以本文件
  Verification Plan 为准。
- [补充] `email_bindings` 语义已由人类确认（2026-10-10）：不是邮箱账号表，
  后续任何任务不得向其添加 password / provider 字段。

---

## Notes

- pnpm 版本事实（官方文档口径）：`allowBuilds` 于 v10.26.0 引入；
  `onlyBuiltDependencies` / `neverBuiltDependencies` / `ignoredBuiltDependencies`
  自 v11 起被移除并由 `allowBuilds` 取代；本地 pnpm 10.29.3 实测仍读取
  `package.json` 的 `pnpm` 字段（无警告），CI 的 12.10.1 明确警告并不再读取。
- 本地复现 CI 依赖问题的方法：`npx pnpm@12.10.1 install`（临时目录，勿在项目内跑）。

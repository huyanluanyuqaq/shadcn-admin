# TASK-003 — 业务模块：套餐 / 客户 / 订阅 / 邮箱 的 CRUD

## Meta

```yaml
Task ID: TASK-003
Title: 业务模块：套餐 / 客户 / 订阅 / 邮箱 的 CRUD
Workflow: feature
Status: DONE
Priority: P1
Owner: developer
Owner Since: 2026-10-09
Assigned Role: developer
Created: 2026-10-09
Updated: 2026-10-09
Completed: 2026-10-10
Self-Approved: true (user delegated, 2026-10-10)
Branch: ""
Requires Human Approval: false
```

---

## Objective

交付四个核心业务模块的完整 CRUD：套餐、客户、订阅、邮箱（含提供商），
前端复用 `src/components/data-table/` 与 `features/users/` 的 CRUD 范式。

---

## Background

基座提供了成熟的可复用资产：

- `src/components/data-table/` — 分页、列显隐、排序、faceted 筛选、批量操作
- `features/users/` — Provider + Columns + Table + Dialogs + BulkActions + DeleteDialog 完整骨架
- `features/tasks/` — 同上，且含 `import-dialog`（可改造为 Excel 导入）

本 Task 将 mock 数据替换为真实 API，并在此基础上派生业务模块。

关联：[架构总览 §6](../docs/architecture/overview.md)

---

## Scope

**后端**
- `plans` / `categories` / `customers` / `subscriptions` / `subscription_pool` / `email_accounts` / `email_providers` 七张表的 REST 路由
- 列表支持分页、排序、多条件筛选（与前端表格能力对齐）

**前端**
- 由 `features/users/` 派生 `features/customers/`
- 由 `features/tasks/` 派生 `features/subscriptions/`（含 Excel 导入）
- 新建 `features/plans/`、`features/emails/`
- 删除 `features/apps/`、`features/chats/`
- 移除对应模块的 faker mock 数据，改为 TanStack Query 调用 API

## Non-Scope

- 订阅链接的远程解析与流量同步（属 TASK-006）
- 仪表盘 / 通知 / 日志（属 TASK-004）
- 容器化（属 TASK-005）

---

## Requirements

1. 七个资源均提供列表（分页+排序+筛选）、创建、编辑、删除、批量删除接口。
2. 前端四个模块页面可完成对应资源的完整 CRUD 交互。
3. 列表与筛选在服务端执行，不得全量拉取后在前端过滤。
4. 所有请求体与响应体经 zod 校验（schema 位于 `shared/`）。
5. 全部 mock 数据移除后，`@faker-js/faker` 从 devDependencies 中删除。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 列表筛选/排序必须在服务端执行 |
| 技术 | 复用 `data-table` 组件，不得另造表格实现 |
| 安全 | 所有写操作接口受 JWT 中间件保护 |
| 兼容 | `src/components/ui/` 与 `routeTree.gen.ts` 不手工编辑 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-001 | blocks | 未完成 |
| TASK-002 | blocks | 未完成 |

---

## Acceptance Criteria

- [ ] AC-1: 四个模块的列表页可从 API 加载真实数据，刷新后数据保持
- [ ] AC-2: 每个模块可完成创建、编辑、单条删除、批量删除
- [ ] AC-3: 列表分页与排序由服务端返回结果，前端不持有全量数据
- [ ] AC-4: `features/apps/` 与 `features/chats/` 已删除，路由不可访问
- [ ] AC-5: 仓库内无 `@faker-js/faker` 引用
- [ ] AC-6: `pnpm build` 成功

---

## File Scope

```yaml
File Scope:
  - server/src/routes/{plans,categories,customers,subscriptions,subscription-pool,emails,email-providers}.ts
  - src/features/customers/**
  - src/features/subscriptions/**
  - src/features/plans/**
  - src/features/emails/**
  - src/features/apps/**      (删除)
  - src/features/chats/**     (删除)
  - src/routes/_authenticated/**
  - shared/**
  - package.json
Non-Scope (files):
  - src/components/ui/**
  - src/components/data-table/**
  - src/routeTree.gen.ts
```

---

## Implementation Plan

1. 后端七张表的路由与 zod schema
2. 派生 `features/customers/` 与 `features/subscriptions/`
3. 新建 `features/plans/` 与 `features/emails/`
4. 删除 apps / chats，清理 faker 与依赖
5. 前后端联调与验收

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 手工 | 启动前后端，创建记录后刷新页面确认持久化 |
| AC-2 | 手工 | 逐模块执行增改删与批量删除 |
| AC-3 | 手工 | 构造 >100 条数据，确认分页请求带 page/size 参数 |
| AC-4 | 手工 | 访问原 apps/chats 路由确认 404 |
| AC-5 | 命令 | `grep -r faker src/ server/` 无命中 |
| AC-6 | 命令 | `pnpm build` |

---

## Current State

尚未开始，依赖 TASK-001 与 TASK-002。

---

## Known Issues

- `features/tasks/` 的 `import-dialog` 原为 CSV/演示用途，改造为 Excel 导入需额外引入解析依赖（本 Task 仅复用其交互骨架）。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| — | — | — | — | 尚无交接 |

**Next Action：** 待 TASK-001 / TASK-002 完成后由 Developer 领取。

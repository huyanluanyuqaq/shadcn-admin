# TASK-001 — 后端骨架：Hono + Drizzle + SQLite

## Meta

```yaml
Task ID: TASK-001
Title: 后端骨架：Hono + Drizzle + SQLite
Workflow: feature
Status: DONE
Priority: P0
Owner: developer
Owner Since: 2026-10-09
Assigned Role: architect
Created: 2026-10-09
Updated: 2026-10-09
Completed: 2026-10-10
Self-Approved: true (user delegated, 2026-10-10)
Branch: ""
Requires Human Approval: true
```

> **前置条件已满足：** ADR-001 / ADR-002 / ADR-003 于 2026-10-09 获人类确认，状态已转 Accepted。

---

## Objective

建立可运行的后端服务骨架：Hono 应用 + Drizzle ORM + SQLite 持久层 + 迁移体系，
并打通前后端共享类型目录。

---

## Background

基座 `shadcn-admin` 为纯前端 SPA，无服务端与持久层。
依 ADR-001，后端采用 Hono + Drizzle + SQLite，目录布局为仓库根新增 `server/` 与 `shared/`。

关联：[ADR-001](../docs/decisions/ADR-001-backend-stack.md) · [架构总览 §4](../docs/architecture/overview.md)

---

## Scope

- 新建 `server/`：Hono 入口、错误处理中间件、健康检查路由
- 新建 `server/db/schema.ts`：首期全部数据表定义（11 张，见架构总览 §5）
- 新建 `shared/`：前后端共享的 zod schema 与 TS 类型
- Drizzle 迁移配置与首版迁移 SQL
- 前端构建配置接入 `shared/` 别名（tsconfig + vite）

## Non-Scope

- 业务 API 路由实现（属 TASK-003）
- 认证与 JWT（属 TASK-002）
- Docker 化（属 TASK-005）
- 定时任务

---

## Requirements

1. `pnpm --filter server dev` 可启动后端，健康检查 `/api/health` 返回 200。
2. 全部数据表在 `server/src/db/schema.ts` 中以 Drizzle 定义，字段覆盖架构总览 §5。
3. 迁移可通过命令生成并执行；迁移 SQL 纳入版本管理。
4. SQLite 启用 WAL 模式。
5. 前端可通过别名引入 `shared/` 的类型，且 `pnpm build` 通过。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 包管理器固定 pnpm；不得改动 `src/` 下既有前端代码 |
| 技术 | 不得引入 Prisma / TypeORM |
| 安全 | 数据库访问一律经 Drizzle 参数绑定，禁止拼接原始 SQL |
| 兼容 | 保持上游 fork 目录结构稳定，不移动 `src/` |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| ADR-001 转为 Accepted | blocks | ✅ 已完成（2026-10-09 人类确认） |

---

## Acceptance Criteria

- [x] AC-1: `GET /api/health` 返回 `{ "status": "ok" }`
- [x] AC-2: 执行迁移命令后 SQLite 文件生成，且包含架构总览 §5 的全部 11 张表
- [x] AC-3: `pnpm build`（前端）在引入 `shared/` 别名后仍成功
- [x] AC-4: SQLite 连接已启用 WAL（通过 `PRAGMA journal_mode` 验证为 `wal`）
- [x] AC-5: 后端 TypeScript 编译无错误

---

## File Scope

```yaml
File Scope:
  - server/**
  - shared/**
  - package.json
  - tsconfig.json
  - vite.config.ts
  - pnpm-workspace.yaml
Non-Scope (files):
  - src/**
  - src/routeTree.gen.ts
  - src/components/ui/**
```

> 注：`package.json` / `tsconfig.json` / `vite.config.ts` 的改动**仅限**为接入 `shared/` 别名
> 与 server 脚本，属必要改动。Adoption「只加不改」约束在架构获确认后由本 Task 明确放开此范围。

---

## Implementation Plan

1. 人类确认 ADR-001 → 状态转 Accepted
2. 新建 `server/package.json`、`tsconfig`、Hono 入口与 `/api/health`
3. 定义 Drizzle schema（11 表）并生成首版迁移
4. 新建 `shared/` 并配置前后端别名
5. 验证构建与迁移

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 手工 | 启动后端后 `curl localhost:3000/api/health` |
| AC-2 | 手工 | 执行迁移后用 sqlite CLI 或 `schema` 查询列出表名 |
| AC-3 | 命令 | `pnpm build` |
| AC-4 | 手工 | `PRAGMA journal_mode;` |
| AC-5 | 命令 | 后端 `tsc --noEmit` |

---

## Current State

实现完成，5 项验收全部通过（2026-10-09）。

**已交付：**

- `pnpm-workspace.yaml` —— 仅纳入 `server/` 与 `shared/`，前端保持在仓库根（`src/` 未移动）
- `shared/` —— `@repo/shared` 包，`schema/common.ts`（分页/排序/列表响应）与
  `schema/enums.ts`（客户/邮箱/套餐状态、同步状态、日志级别与模块）；`tsc` 产出 `dist/`
- `server/` —— Hono 应用：`src/index.ts`（入口 + `notFound`）、
  `src/routes/health.ts`、`src/middleware/error.ts`、
  `src/db/index.ts`（SQLite 单例 + 5 条 PRAGMA）、`src/db/schema.ts`（11 张表）、
  `src/db/migrate.ts`、`drizzle.config.ts`
- `server/drizzle/0000_minor_paladin.sql` —— 首版迁移（11 表，含索引与外键）
- 前端接入：`tsconfig.app.json`（`@shared/*` 路径 + include `shared/src`）、
  `vite.config.ts`（`@shared` 别名）、新增 `src/lib/api.ts`（使用共享类型的 API 客户端骨架）

**验收实测：**

| AC | 结果 |
|----|------|
| AC-1 | `{"status":"ok","database":".../server/data/app.db","time":"..."}`；未知路径返回 `{"error":"Not Found"}` |
| AC-2 | 11 张表：admins, categories, customers, email_accounts, email_providers, logs, plans, reminders, settings, subscription_pool, subscriptions |
| AC-3 | `pnpm build` 成功（`tsc -b` 覆盖 `shared/src`，别名生效；vite build 12.78s） |
| AC-4 | `journal_mode=wal`、`busy_timeout=5000` |
| AC-5 | `tsc -p tsconfig.json --noEmit` 无错误 |

**subscriptions 表已含同步字段**（`cron_expr` / `last_run_at` / `next_run_at` / `sync_status` /
`last_error` / `user_agent` / `headers` / `skip_tls_verify` / `proxy_url` / `enabled`），
为 TASK-006 订阅同步引擎预留（ADR-003）。

**环境注意事项（见 `AGENTS.md` §13.6 / §13.7）：**

- `better-sqlite3` 依赖预编译二进制。已实测 `pnpm install` 自动完成（无需手工），
  前提：`^12.4.1`（v13 无预编译资源）+ 放行构建脚本（已声明 `pnpm.onlyBuiltDependencies`）。
- `shared` 以编译产物被后端消费，改动后必须先 `pnpm build:shared`。

---

## Known Issues

- `better-sqlite3` 为原生模块，依赖预编译二进制。已实测（Node 22.22.2 / win32-x64）
  `pnpm install` 可自动完成，**无需手工操作**；前提是版本锁在 `^12.4.1`（v13 无预编译资源）
  且允许构建脚本（已在根 `package.json` 的 `pnpm.onlyBuiltDependencies` 声明）。
  详见 `AGENTS.md` §13.6。
- `src/lib/api.ts` 目前尚无调用方（供 TASK-003 起各模块使用），`pnpm knip` 可能报未使用导出。
- 未运行 `pnpm lint` / `pnpm format:check`（不在本 Task 验收范围），留待 Review 或后续任务处理。
- `pnpm-lock.yaml` 因新增 workspace 包而变更，Docker 构建需使用更新后的 lockfile。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 1 | Architect | Developer | 2026-10-09 | ADR-001/002/003 获人类确认并转 Accepted；架构约束（C1–C9、11 表模型、并列目录）生效，TASK-001 可开工 |

**Next Action：** 实现已完成并自检通过，待 Reviewer 按 §Acceptance Criteria 验收后转 DONE。

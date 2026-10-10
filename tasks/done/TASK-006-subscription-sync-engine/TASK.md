# TASK-006 — 订阅同步引擎（参照 sublinkPro）

## Meta

```yaml
Task ID: TASK-006
Title: 订阅同步引擎（参照 sublinkPro）
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

实现订阅链接的定时拉取与更新：解析 Clash/Mihomo 订阅的用量与到期信息，
写入 `subscriptions` 表，并在失败时记录日志与触发通知。
设计参照 sublinkPro（Go + React，1.6k stars，MIT）的生产实现，并在其缺口处加严。

---

## Background

用户指示本项目订阅链接拉取更新参照 [sublinkPro](https://github.com/ZeroDeng01/sublinkPro)。

调研结论（2026-10-09，源码级）：

| 层 | sublinkPro | 是否采纳 |
|----|-----------|---------|
| 调度 | `robfig/cron/v3`，每机场一条独立 job，cron 存库 + 热重载 | 采纳 |
| 拉取 | 10s 超时，**HEAD 优先**，非 2xx 回退 GET，UA `clash.meta` | 采纳 |
| 解析 | 响应头 `subscription-userinfo` | 采纳 |
| 入库 | 单条 `UpdateUsageInfo` + `changedNodeIDs` 增量对比 | 增量采纳，写入改为单事务 |
| 失败 | `notifications.Publish("subscription.sync_failed")` | 采纳 |
| SQLite | `_busy_timeout=5000` / `WAL` / `NORMAL` / `_cache_size=-64000` / `_foreign_keys=ON` | 采纳 |

**必须修正的三个缺口：**

1. `BatchUpdateAirportUsage` 无限 goroutine → 本项目加并发上限
2. 无 `SkipIfStillRunning` → 本项目加单飞锁
3. 无 jitter → 本项目加随机延迟

**平台差异：** sublinkPro 为 Go 多 goroutine + 连接池（MaxOpen=100）；
本项目为 Node 单线程 + `better-sqlite3` **同步 API**，不引入连接池，写入必须合并单事务。

关联：[架构总览 §10](../docs/architecture/overview.md) ·
[ADR-003 订阅同步设计](../docs/decisions/ADR-003-subscription-sync-design.md)

---

## Scope

**后端**
- `server/src/services/subscription-sync.ts` — 拉取、解析、增量对比、批量写入
- `server/src/services/scheduler.ts` — cron 注册、热重载、单飞锁、jitter、状态回写
- `server/src/db/schema.ts` — `subscriptions` 表补充同步字段
- `POST /api/subscriptions/:id/sync`（单条手动触发）
- `POST /api/subscriptions/sync`（批量触发）
- `POST /api/subscriptions/scheduler/reload`（热重载）
- `GET /api/subscriptions/:id/sync-logs`（同步历史，可选）

**前端**
- 订阅列表展示 `sync_status` / `last_run_at` / `next_run_at`
- 单条与批量「立即同步」操作按钮
- cron 表达式编辑入口

## Non-Scope

- 节点内容的完整解析与测速（sublinkPro 的 `LoadClashConfigFromURL` / `UpdateAfterDetect`）
- 自动打标签规则（`applyAutoTagRules`）
- 实际运行代理流量（不引入 mihomo 二进制）
- 订阅 CRUD 本体（属 TASK-003）

---

## Requirements

1. **C1** 禁止在事务内执行网络 IO；`db.transaction()` 回调必须为同步函数。
2. **C2** 批次结果合并为单个事务写入，fsync 次数为 1 而非 N。
3. **C3** 拉取并发上限 `CONCURRENCY`（默认 5，取值范围 1–20，可配）。
4. **C4** 定时触发叠加 jitter（随机 0–10 分钟）。
5. **C5** 单条拉取 10s 超时，失败隔离（`Promise.allSettled`），不得阻塞整批。
6. **C6** 单飞锁：同一订阅未跑完不得重入；锁需带时间戳与超时兜底。
7. **C7** **HEAD 优先**，非 2xx 或 `subscription-userinfo` 缺失时回退 GET。
8. **C8** 增量对比：仅当 `upload`/`download`/`total`/`expire` 变化时才写库并触发通知。
9. **C9** cron 表达式存 `subscriptions.cron_expr`，支持热重载，执行后回写 `last_run_at` / `next_run_at`。
10. 启动时统一 `LoadFromDatabase()` 注册全部 job。
11. 同步失败写 `logs`（level=error，module=subscription-sync）并触发通知渠道。
12. SQLite 启动时执行：
    ```sql
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    PRAGMA cache_size = -64000;
    ```

**新增字段（`subscriptions`）：**
`cron_expr` · `last_run_at` · `next_run_at` · `sync_status` · `last_error` ·
`user_agent` · `headers(json)` · `skip_tls_verify` · `proxy_url`

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 写入必须合并单事务，禁止逐条 `db.update()` |
| 技术 | 不引入连接池（Node 单线程 + better-sqlite3 同步 API） |
| 技术 | **镜像内不安装 mihomo 二进制**；代理出口用 undici `ProxyAgent` + `PROXY_URL` |
| 技术 | 并发上限取值硬约束在 1–20 |
| 安全 | 同步接口受 JWT 中间件保护 |
| 兼容 | 不得修改 `src/components/ui/**` 与 `src/routeTree.gen.ts` |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-001 | blocks | 未完成 |
| TASK-002 | blocks | 未完成 |
| TASK-003 | blocks | 未完成（需 `subscriptions` 表与路由） |

---

## Acceptance Criteria

- [ ] AC-1: 单条订阅可通过 API 手动触发同步，用量与到期正确写入数据库
- [ ] AC-2: 批量同步 100 条时，数据库写入为**单个事务**（可通过日志/计时确认）
- [ ] AC-3: 并发不超过配置上限；可通过 mock server 观测并发峰值
- [ ] AC-4: 单条链接超时（>10s）不影响其余订阅完成同步
- [ ] AC-5: 同一订阅在上一次未完成时再次触发，不会重入
- [ ] AC-6: 对返回 HEAD 但不带 `subscription-userinfo` 的上游，自动回退 GET 并成功解析
- [ ] AC-7: 用量未变化时**不产生**写库与通知（增量对比生效）
- [ ] AC-8: 修改数据库中的 `cron_expr` 后调用 reload，无需重启容器即生效
- [ ] AC-9: 同步失败时写入 `logs` 且 `last_error` 有值
- [ ] AC-10: 容器启动时自动注册全部启用状态的订阅 job
- [ ] AC-11: `grep -rn "mihomo" Dockerfile docker-compose.yml` 无命中
- [ ] AC-12: `pnpm build` 成功

---

## File Scope

```yaml
File Scope:
  - server/src/services/subscription-sync.ts      (新增)
  - server/src/services/scheduler.ts               (新增)
  - server/src/services/subscription-parser.ts     (新增)
  - server/src/routes/subscriptions-sync.ts        (新增)
  - server/src/db/schema.ts                        (补充同步字段)
  - server/drizzle/**                              (迁移 SQL)
  - src/features/subscriptions/**
  - shared/**
Non-Scope (files):
  - src/components/ui/**
  - src/components/data-table/**
  - src/routeTree.gen.ts
  - Dockerfile                                     (禁止添加 mihomo 下载段)
```

---

## Implementation Plan

1. `subscriptions` 表补充同步字段 + 生成迁移
2. 实现 `subscription-parser.ts`：HEAD 优先 / 回退 GET / 10s 超时 / UA 轮换 / 解析响应头
3. 实现 `subscription-sync.ts`：并发分批 + `allSettled` + 增量对比 + 单事务批量写入
4. 实现 `scheduler.ts`：cron 注册 / 热重载 / 单飞锁 / jitter / 状态回写 / 启动加载
5. 路由：单条同步、批量同步、reload
6. 前端：同步状态列 + 立即同步按钮 + cron 编辑
7. 联调与验收（含 mock 上游压测）

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 手工 | 配置一条真实或 mock 订阅，调用同步接口后查库 |
| AC-2 | 命令 | 开启 SQL 日志，确认 100 条写入仅出现 1 次事务边界 |
| AC-3 | 手工 | 本地 mock server 记录并发峰值，确认 ≤ CONCURRENCY |
| AC-4 | 手工 | 注入一条 15s 延迟的上游，确认其余订阅正常完成 |
| AC-5 | 手工 | 连续两次触发同一订阅，确认第二次被跳过 |
| AC-6 | 手工 | mock 上游 HEAD 不带 userinfo 头，确认回退 GET 成功 |
| AC-7 | 手工 | 连续两次同步同一未变化订阅，确认第二次无 UPDATE 与通知 |
| AC-8 | 手工 | 改库 `cron_expr` → 调 reload → 确认 `next_run_at` 更新 |
| AC-9 | 手工 | 配置不可达 URL，确认 `logs` 与 `last_error` 落库 |
| AC-10 | 手工 | 重启容器后确认 job 全部注册 |
| AC-11 | 命令 | `grep -rn "mihomo" Dockerfile docker-compose.yml` |
| AC-12 | 命令 | `pnpm build` |

---

## Current State

尚未开始，依赖 TASK-001 / TASK-002 / TASK-003。

---

## Known Issues

- 部分机场对 HEAD 请求实现不一致，回退 GET 是必要兜底，但会失去带宽优势；
  可在 `subscriptions` 增加 `force_get` 标记供人工覆盖（首期不实现）。
- 单飞锁当前设计为进程内标记，多实例部署时需改为数据库层或分布式锁；
  届时通常伴随 SQLite → PostgreSQL 迁移。
- `changedNodeIDs` 式的节点级增量对比依赖完整订阅正文解析，本项目首期只做
  **订阅级**（upload/download/total/expire）增量，不做节点级。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| — | — | — | — | 尚无交接 |

**Next Action：** 待 TASK-001 / TASK-002 / TASK-003 完成后由 Developer 领取。

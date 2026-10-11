# TASK-015 — 系统备份（SQLite 在线备份 + 每日调度 + 管理页）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-015
Title: 系统备份（SQLite 在线备份 + 每日调度 + 管理页）
Workflow: feature
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-11
Assigned Role: developer
Created: 2026-10-11
Updated: 2026-10-11
Branch: feat/TASK-015-system-backup
Requires Human Approval: false
```

---

## Objective

用户原话：「开始配置系统备份」。经需求确认（2026-10-11，四项均按推荐默认）：

1. **内容**：仅 SQLite 数据库（`app.db`），用 `VACUUM INTO` 在线一致性导出
   （WAL 模式下裸拷贝文件会丢最近写入，ADR-001/TASK-005 早有此结论但未落地自动化）。
2. **位置**：仅本地 `<数据目录>/backups/`（容器内 `/app/data/backups/` →
   宿主机 `./data/backups/`，随现有卷持久化，删容器不丢）。
3. **频率与保留**：调度器每日任务（env `BACKUP_CRON`，默认 `0 3 * * *`）；
   保留最近 N 份（env `BACKUP_KEEP`，默认 7），超出自动删最旧。
4. **管理**：后端 REST（列表 / 立即备份 / 下载 / 删除）+ 前端「系统备份」页
   （侧边栏「系统」组入口）。

---

## Background

- 部署形态：单容器 docker compose，SQLite（WAL）持久化在 `./data` 卷。
- 已有 croner 调度器（订阅同步逐条 + 每日提醒扫描 TASK-013），备份 job 沿用同一模式。
- 无任何既有备份实现（grep 全仓仅 ADR-001/TASK-005 的文字结论）。

---

## Scope

- shared：`backupFileSchema` / `backupPolicySchema` 及类型（响应契约）。
- 后端：`services/backup.ts`（VACUUM INTO + 保留策略 + 文件名校验防穿越）；
  `routes/backups.ts`（四端点，全部在鉴权中间件之后）；调度器每日 job；
  env 配置（`BACKUP_CRON` / `BACKUP_KEEP` / `BACKUP_DIR`）。
- 前端：`features/backups/`（queries + 表格 + 页面）；路由
  `/_authenticated/backups/`；侧边栏「系统」组入口。
- 文档：架构 overview 新增备份节；api-contract 补四端点；
  operations 补备份/恢复 runbook；.env.example 补变量说明。
- 验证：冒烟新增备份段（含保留策略与路径穿越防护）；前端单测补表格交互。

## Non-Scope

- **不做远程存储**（S3/WebDAV/Telegram 等）——用户明确选仅本地；runbook 中
  给出「宿主机 rsync 拉走 backups 目录」的异地建议即可。
- **不做备份内容可配置**（数据库+.env+日志等组合）——用户明确选仅数据库。
- **不做恢复功能**（从备份还原数据库）——属高危操作，runbook 给出手工步骤
  （停服务 → 替换 app.db → 重启），不做成一键按钮。
- **不改 WAL/PRAGMA 等既有数据库配置**。

---

## Requirements

1. `POST /api/backups`：执行 `VACUUM INTO '<dir>/app-YYYYMMDD-HHmmss-sss.db'`，
   返回 `{ filename, size, createdAt }`；目标已存在时报错（不覆盖）。
2. `GET /api/backups`：返回 `{ items: BackupFile[]（新→旧）, policy: { keep, cron } }`。
3. `GET /api/backups/:filename/download`：带鉴权下载，`Content-Disposition: attachment`。
4. `DELETE /api/backups/:filename`：删除，404 当不存在。
5. **文件名白名单校验**：仅接受 `^app-\d{8}-\d{6}-\d{3}\.db$`，拒绝任何其他输入
   （防路径穿越 `../`）；resolve 后仍须落在备份目录内（双保险）。
6. 保留策略：每次备份后按创建时间排序，超出 `keep` 删最旧；
   `keep <= 0` 或非整数回落 7。
7. 备份目录：env `BACKUP_DIR` 优先，否则 `<DATABASE_URL 所在目录>/backups`；
   不存在则创建。
8. 调度：`enableScheduler` 时注册每日 job（`BACKUP_CRON` 默认 `0 3 * * *`），
   失败仅记日志不崩进程；`stop()` 一并停止。
9. 前端「系统备份」页：列表（文件名/大小/创建时间）、立即备份按钮
   （pending 时 Loader2 旋转 + 禁用）、行内下载/删除（删除走 ConfirmDialog）、
   刷新按钮（TASK-014 模式：isFetching 旋转 + 禁用）、展示保留策略文案。
10. 下载走带鉴权的 blob 下载（api 客户端只解析 JSON，不能直接用）。

---

## Acceptance Criteria

- [x] AC-1: POST 备份产出合法文件；GET 列表含该文件且 policy 正确；
      DOWNLOAD 返回附件；DELETE 删除成功且再 DELETE 返回 404。
      （冒烟 18.1–18.4 全过）
- [x] AC-2: `BACKUP_KEEP=2` 下连做 3 次备份，目录只剩最新 2 份。
      （冒烟以默认 keep=7 连做 8 次做等价截断验证：恰剩 7 份、首被删、末保留，18.5 过）
- [x] AC-3: 路径穿越（`..%2F..%2Fx`、绝对路径、非法名）一律 400/404，
      不触碰备份目录之外的文件。（冒烟 18.4 过：`..%2F..%2Fapp.db` 与 `not-a-backup.db` 均拒绝）
- [x] AC-4: 调度器启动日志出现备份任务注册行；env 可覆盖 cron。
      （3002 隔离实例启动日志确认 `已注册每日数据库备份任务（0 3 * * *）`；env 走 config.backupCron）
- [x] AC-5: 前端页面可完成 立即备份/下载/删除/刷新，刷新有旋转动画（TASK-014 模式）。
      （backups-table 5 例单测覆盖渲染/立即备份/刷新/下载/删除确认流；3000 实例 API 实测 200 + policy）
- [x] AC-6: `pnpm build` / `pnpm --filter server typecheck` / lint /
      format:check / 冒烟 / 前端单测全绿。
      （build ✓；server typecheck ✓；lint ✓（修复 1 处重复 import）；format:check ✓；
       冒烟 125/125 ✓；前端单测 181/181 ✓）

---

## File Scope

```yaml
File Scope:
  - shared/src/schema/entities.ts            # backupFileSchema / backupPolicySchema
  - server/src/services/backup.ts            # 新增：VACUUM INTO + 保留 + 校验
  - server/src/routes/backups.ts             # 新增：四端点
  - server/src/services/scheduler.ts         # 每日备份 job
  - server/src/index.ts                      # 注册路由 + job
  - server/src/env.ts                        # BACKUP_CRON/KEEP/DIR
  - server/scripts/smoke.ts                  # 冒烟备份段
  - .env.example                             # 变量说明
  - docker-compose.yml                       # env 透传（可选默认）
  - src/features/backups/**                  # 新增：queries + 表格 + 页面
  - src/features/backups/components/backups-table.test.tsx  # 前端单测
  - src/routes/_authenticated/backups/index.tsx  # 路由
  - src/components/layout/data/sidebar-data.ts   # 侧边栏入口
  - src/routeTree.gen.ts                     # 自动生成（build 时重建）
  - docs/architecture/overview.md            # 备份设计节
  - docs/technical/api-contract.md           # 四端点契约
  - docs/operations/backup-restore.md        # 新增 runbook
  - tasks/active/TASK-015-system-backup/**
```

---

## Implementation Plan

1. shared：backup schemas + `pnpm build:shared`。
2. 后端：backup.ts（VACUUM INTO/保留/校验）→ routes → env → scheduler → index。
3. 前端：queries → table（含 TASK-014 刷新模式）→ page → route → sidebar。
4. 冒烟段 + 前端单测 + 文档 + .env.example。
5. 全门禁验证。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1/3 | 冒烟 | `pnpm --filter server smoke`（新增段） |
| AC-2 | 冒烟（默认 keep=7，做 8 次验证截断） | 同上 |
| AC-4 | 冒烟 + 启动日志 | 见上 |
| AC-5 | 前端单测 + 端口 3000/5173 实测 | `pnpm test` |
| AC-6 | 门禁 | build / typecheck:server / lint / format:check |

---

## Current State

> 2026-10-11：需求已确认（本地/仅数据库/每日+7份/要管理页），开始实施。
>
> 2026-10-11（完成）：全量实施 + 门禁通过。冒烟新增第 18 段 8 项检查
> （立即备份 / 列表+policy / 下载附件 / 路径穿越与白名单外拒绝 / 不存在删除 404 /
> 保留策略 8 连做截断为 7 / 清理），对 3002 隔离实例（真实库 VACUUM INTO 快照 +
> 指向内嵌 mock）实测 **125 通过 / 0 失败**；前端单测 181/181；build/typecheck/
> lint/format:check 全绿。用户 3000 实例（tsx watch 热加载）已实测带备份路由
> （GET /api/backups 200 + policy），5173 前端可直接看到「系统 → 系统备份」页。
> 文档三件套（架构 §12.8 / api-contract / operations runbook）与 .env.example、
> docker-compose env 透传均已落地。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| shared/src/schema/entities.ts | 修改 | 新增 `backupFileSchema` / `backupPolicySchema` 及类型 |
| server/src/services/backup.ts | 新增 | VACUUM INTO 在线备份 + 保留策略 + 文件名白名单/resolve 双保险 |
| server/src/routes/backups.ts | 新增 | 四端点（列表/立即/下载/删除），鉴权中间件之后 |
| server/src/services/scheduler.ts | 修改 | 每日备份 job（croner `db-backup`，成功/失败均写 logs），stop() 一并停 |
| server/src/index.ts | 修改 | 注册 `/api/backups` 路由；enableScheduler 块调 startBackupJob() |
| server/src/env.ts | 修改 | config 增 backupCron / backupKeep / backupDir |
| server/scripts/smoke.ts | 修改 | 新增第 18 段「系统备份」8 项检查；req() 助手返回 headers 供下载断言 |
| src/features/backups/queries.ts | 新增 | useBackupsQuery / useCreateBackup / useDeleteBackup + downloadBackup（blob） |
| src/features/backups/components/backups-table.tsx | 新增 | 列表 + 立即备份（Loader2）+ 下载/删除（ConfirmDialog）+ 刷新（TASK-014 模式）+ 错误态重试 |
| src/features/backups/components/backups-table.test.tsx | 新增 | 5 例：渲染/立即备份/刷新/下载/删除确认流 |
| src/features/backups/index.tsx | 新增 | Header/Main 页面骨架 |
| src/routes/_authenticated/backups/index.tsx | 新增 | createFileRoute('/_authenticated/backups/') |
| src/components/layout/data/sidebar-data.ts | 修改 | 「系统」组「日志」后插入「系统备份」入口 |
| src/routeTree.gen.ts | 修改 | 自动生成（build 重建） |
| .env.example | 修改 | 补 BACKUP_CRON / BACKUP_KEEP / BACKUP_DIR 说明 |
| docker-compose.yml | 修改 | BACKUP_CRON / BACKUP_KEEP env 透传（默认值同代码） |
| docs/architecture/overview.md | 修改 | 新增 §12.8 系统备份设计 |
| docs/technical/api-contract.md | 修改 | 新增「系统备份」四端点契约 |
| docs/operations/backup-restore.md | 新增 | 备份/恢复 runbook（含异地 rsync 建议与手工恢复步骤） |

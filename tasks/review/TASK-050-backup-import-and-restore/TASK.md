# TASK-050 — 备份导入与备份恢复（补齐导出之外的两项能力）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-050
Title: 备份导入与备份恢复（补齐导出之外的两项能力）
Workflow: feature
Status: REVIEW
Priority: P1
Owner: "Claude Code (Opus 5) / 执行位 Implementer"
Owner Since: "2026-10-31T00:00:00+08:00"
Assigned Role: developer
Created: 2026-10-30T23:59:00+08:00
Updated: 2026-10-30T23:59:00+08:00
Branch: feat/TASK-050-backup-import-and-restore
Requires Human Approval: true
```

---

## Objective

在既有「备份导出」之外补齐**备份导入**与**备份恢复**两项能力，使「备份 → 异地保存 → 灾后取回 → 恢复」形成闭环：
运维可在管理页上传一个 `.db` 备份文件入列，并可点击行内「恢复」把系统数据回滚到该备份，且能证明恢复后数据确为该备份的内容。

---

## Background

**现状核查（主控位已完成，main `dbb3698` 逐文件实读，非推断）：**

> ⚠️ 本节是**本任务开工前**（2026-10-30，`main dbb3698`）的基线快照，描述的是「当时」的状态。
> 本任务交付后，「导入 = 零实现」「恢复 = 零实现」两行**已被本任务推翻**，
> 当前能力以 `docs/architecture/overview.md` §12.8、`docs/technical/api-contract.md`
> 「系统备份」节、`docs/operations/backup-restore.md` §3 为准。

| 能力 | 状态 | 证据 |
|------|------|------|
| 备份导出（生成 + 下载） | ✅ 完整 | `server/src/services/backup.ts:94` `runBackup()`（`VACUUM INTO`，`:102`）；`server/src/routes/backups.ts:31` POST、`:48` download；`src/features/backups/queries.ts:54` blob 下载；冒烟 `server/scripts/smoke.ts:2689-2800`；单测 `src/features/backups/components/backups-table.test.tsx` 5 例 |
| 备份导入（上传入列） | ❌ 零实现 | 全仓 `multipart` / `formData(` / `upload` / `importBackup` 零命中；`backupRoutes` 仅 GET/POST/DELETE 四端点，无上传端点；前端表格操作列只有下载与删除 |
| 备份恢复（应用内还原） | ❌ 零实现 | `tasks/done/TASK-015-system-backup/TASK.md:66` 明确列为 Non-Scope；`docs/architecture/overview.md:604`、`docs/operations/backup-restore.md:42` 均声明「不做应用内一键恢复」 |

**为什么现在必须补：** 缺导入 ⇒ `docs/operations/backup-restore.md:97` 建议的 rsync/rclone 异地容灾是**单向**的，灾后无通道把备份取回；缺恢复 ⇒ 无宿主机 shell 的部署形态（纯容器 + 托管面板）事实上无法完成恢复。这两项是同一条容灾链的上、下游，只补一半没有运维价值。

**为什么恢复要做成「标记 + 重启后应用」而不是热替换：** `server/src/db/index.ts:27` 是模块加载期就建立的单例 `new Database(dbPath)`，`:35` 的 drizzle 实例绑定该连接；`server/src/services/logger.ts:1` 等大量模块直接 import 该单例。在运行中 close 再 open 无法安全替换所有引用（且在途请求会拿到已关闭的连接）。重启式恢复还能顺带满足「恢复必须删除 `-wal`/`-shm`」这一硬性要求（runbook §3.1 第 3 步），避免遗漏该步导致的数据损坏。容器侧已有 `docker-compose.yml:39` `restart: unless-stopped`，退出即自动拉起。

**为什么导入要加完整性校验：** 导入是唯一让**外部字节**进入备份目录并可能被用于恢复的入口。若不校验，一个被截断/异库的 `.db` 会被当作可信备份，直到恢复时才炸。

---

## Scope

- **导入能力**：`POST /api/backups/import`（八位字节流上传）+ 完整性/表结构校验 + `imp-` 前缀落盘 + 审计日志；前端「导入备份」按钮与文件选择。
- **恢复能力**：`POST /api/backups/:filename/restore`（202 排程 + 标记文件）+ 启动期应用（`server/src/db/restore.ts`）+ 恢复前自动生成 `pre-restore-*` 回退副本；前端行内「恢复」按钮（ConfirmDialog 二次确认）。
- **文件名体系扩展**：`app-`（本机生成）与 `imp-`（导入）双前缀，白名单正则统一；`pre-restore-` 刻意不入列（防保留策略误删回退副本）。
- **与两项能力直接相关的加固**：下载写审计日志 + `Cache-Control: no-store`；保留策略删除失败写 `error` 日志；恢复/导入的完整性校验结果写入响应的 `policy.restoreAutoExit`（供 UI 与冒烟判断本环境是否会自重启）。
- **文档**：`api-contract`、`overview` §12.8、`backup-restore` runbook、`.env.example`。
- **D13-C 归档回写**：TASK-047 / 048 / 049 的 `Merge Record` 按实测值回填并迁入 `done/`。

## Non-Scope

- 远程存储（S3/WebDAV）、加密、增量备份——沿用 TASK-015 的人类裁决。
- 业务数据导出（CSV/Excel）——与备份快照是两件事，本任务不做。
- 恢复进度条/流式日志、多用户权限分级（系统仍为单管理员 JWT，ADR-002）。
- 备份内容可配置（数据库 + `.env` + 日志的组合）——恢复仅数据库，`.env` 不在快照内。
- 改 `docker-compose.yml`（`restart: unless-stopped` 已具备，不改）。
- 保留策略排序口径（mtime）与 `VACUUM INTO` 同步阻塞——已知项，不在本任务改。
- 修复冒烟的流量阈值存量失败（TASK-049 Known Issues 第 1 条，属独立任务）。

---

## Requirements

1. **导入端点** `POST /api/backups/import`：`Content-Type: application/octet-stream`，可选头 `X-Backup-Filename`（原始文件名，**仅用于审计**，不参与落盘命名）。成功 201 → `{ item: BackupFile, origin: string | null, sha256: string }`。
2. **导入校验链**（任一失败 → 400/413，且备份目录**不留任何残留**）：
   ① `Content-Length` 或实际长度 > 64 MiB → 413；
   ② 长度 < 512 或前 16 字节不等于 `SQLite format 3\0` → 400；
   ③ 只读打开后 `PRAGMA integrity_check` 非 `ok` → 400；
   ④ `sqlite_master` 必须含 `admins` / `customers` / `subscriptions` / `settings` / `logs` 五表 → 否则 400（拒绝无关 SQLite 库）。
3. **导入落盘命名**：`imp-YYYYMMDD-HHmmss-sss.db`（上传时刻）；先写 `<name>.part`，全部校验通过后 `rename` 为最终名（原子）；失败路径必须 `unlink` 临时文件。
4. **恢复端点** `POST /api/backups/:filename/restore`：请求体 `{ confirm: "<filename>" }`。200/202 语义：成功排程 → **202** `{ scheduled: true, filename, restartExpected: boolean }`。
5. **恢复前置校验**：文件名白名单 + 文件存在（否则 404）；`confirm` 与路径参数**逐字相等**（否则 400）；目标文件 `integrity_check` + 五表校验（否则 400，且**不写标记**）。
6. **恢复排程**：写标记 `<db 目录>/.restore-pending.json`（`{ filename, requestedAt, requestedBy }`），写审计日志；默认随后退出进程（`RESTORE_AUTO_EXIT=false` 时**不退出**，仅保留标记，供冒烟断言）。
7. **启动期应用**（`db/index.ts` 在 `new Database` **之前**调用）：存在标记时 —— ① 打开现库跑 `wal_checkpoint(TRUNCATE)` 后 close；② `rename` 现库为 `backups/pre-restore-<ts>.db`；③ `copy` 备份文件为 `app.db`（**保留备份原件**）；④ 删除 `app.db-wal` / `app.db-shm`；⑤ 删除标记；⑥ 返回 outcome 供 `index.ts` 写 `logs`（module=`restore`）。任一步骤失败 → 回滚已做的 rename、**保留标记**、返回 failed。
8. **启动期零副作用**：无标记时函数必须只做一次 `existsSync` 判定，不创建/改名/删除任何文件。
9. **文件名白名单**：`^(app|imp)-\d{8}-\d{6}-\d{3}\.db$`；`resolve` 后仍须位于备份目录内（沿用 TASK-015 双保险）。`pre-restore-*` **不匹配**该正则（故不出现在列表、不被保留策略删除）。
10. **前端**：顶部「导入备份」（隐藏 file input，`accept=".db,application/vnd.sqlite3"`，前端先挡 > 64 MiB）；行内「恢复」按钮 → ConfirmDialog（destructive，文案含「覆盖当前数据库、服务重启、恢复点之后数据丢失」）；`imp-` 文件在文件名旁显示「导入」标识；`policy.restoreAutoExit === true` 时页面顶部提示「本环境恢复后不会自动重启，需手动重启服务」。
11. **恢复后的前端行为**：收到 202 后 toast 提示，并按 2s 间隔轮询 `GET /api/health` 最多 30s，成功后刷新页面；超时则提示手动刷新。
12. **审计**：导入（成功/失败）、恢复排程、恢复应用（成功/失败）、下载，全部写 `logs`（module 分别为 `backup` / `restore`）。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 不引入新依赖（`crypto` / `fs` / `better-sqlite3` 均为既有）；上传按原始字节流处理，不引入 multipart 解析 |
| 架构 | **禁止**在 `db/index.ts` 内 import `services/logger.ts`（`logger.ts:1` 反向依赖 db，会成环）——启动期结果只能由 `index.ts` 消费后写日志 |
| 架构 | **禁止** `db/restore.ts` import `services/backup.ts`（后者 import `db/index.ts`，同样成环）；备份目录与文件名规则抽到无依赖的 `services/backup-naming.ts`，两侧共同引用 |
| 兼容 | 既有四端点与 `BackupFile` 结构不变，仅新增；`app-` 前缀行为逐字节不变 |
| 数据 | 验证只允许使用快照库或 `E:/AiData/` 下的临时目录，**禁止**向 `server/data/app.db` 写入测试行、**禁止**在真实库上执行恢复 |
| 安全 | 恢复必须二次确认（`confirm` 逐字匹配）；下载响应 `Cache-Control: no-store`；导入/恢复拒绝一切白名单外文件名 |
| 运维 | 恢复依赖进程重启（容器 `restart: unless-stopped`）；本地 `tsx watch` 不会因退出而自启，须在 runbook 与 UI 中明示 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-015 备份导出 | blocks（复用文件命名/白名单/保留策略） | 已完成 |
| `docker-compose.yml` 的 `restart: unless-stopped` | external（恢复的自动重启前提） | 已具备（`:39`） |
| TASK-047 / 048 / 049 已合并 | blocks（Phase 5 回写对象） | 已完成（PR #22 / #23 / #24） |

> `backlog/`、`active/` 于 2026-10-30 实测为空（仅本任务即将进入 `backlog/`），无并行争用
> `backup.ts` / `backups.ts` / `db/index.ts`。

---

## Acceptance Criteria

- [x] AC-1: 上传一份合法 SQLite 备份 → 201，返回文件名匹配 `^imp-\d{8}-\d{6}-\d{3}\.db$`、`sha256` 为 64 位十六进制；`GET /api/backups` 的 `items` 含该文件；落盘 `size` 与上传字节数相等
  > 实测：冒烟 19.4（201 + `imp-` 文件名 + `^[0-9a-f]{64}$` + `origin` 回显）、19.5（`item.size` === 上传字节数）、19.6（列表含该文件）全绿。
- [x] AC-2: 上传 0 字节 / 随机字节（无 SQLite 头）/ 超过 64 MiB 的请求分别返回 400 / 400 / 413；三种情形执行后备份目录内**无 `.part` 残留、无新增 `imp-` 文件**
  > 实测：冒烟 19.7（空文件 400）、19.8（1024×0x5A 400）、19.9（64 MiB+1 → 413）、19.11（失败后 `imp-` 仍只有 19.4 那一个 ⇒ 无 `.part` 残留、无新增 `imp-`）全绿。
- [x] AC-3: 上传一个**结构不合规**的 SQLite 库（合法头、`integrity_check` 通过、但缺 `customers` 表）→ 400，且不产生 `imp-` 文件
  > 实测：冒烟 19.10 用一个**真 SQLite 库**（含 admins/subscriptions/settings/logs 四表、`integrity_check` 自然通过、独缺 customers）→ 400；19.11 证明未产生 `imp-` 文件。
- [x] AC-4: 恢复端点前置校验：不存在的文件名 → 404；`..%2F..%2Fapp.db` 与 `not-a-backup.db` → 404；`confirm` 与文件名不一致 → 400；上述四种情形均**不写标记文件**
  > 实测：冒烟 19.12 / 19.13 / 19.14 / 19.15 全绿（19.15 显式断言 `.restore-pending.json` 不存在）。
- [x] AC-5: 合法恢复请求（服务端 `RESTORE_AUTO_EXIT=false`）→ 202，`.restore-pending.json` 存在且 `filename` 字段等于请求目标；进程**未退出**（`GET /api/health` 仍 200）
  > 实测：冒烟 19.16（202 + `restartExpected=false`）、19.17（标记三字段齐全且 `filename` 逐字相等）、19.18（health 仍 200）全绿。
- [x] AC-6: `pnpm --filter server restore-check`（在工作区外临时目录内构造场景）退出码 0，且逐项断言：无标记时零副作用；有标记时 `app.db` 被替换、`-wal`/`-shm` 已删除、`pre-restore-*.db` 已生成、标记已删除
  > 实测：退出码 **0**，**20 通过 / 0 失败**（A1~A3 零副作用、B1~B6 文件替换五要素、D1~D5 回滚路径）。
  > 工作区 `E:/AiData/task050-restore-check-*/`（未清理以供人工复查；已从交付物中排除）。
- [x] AC-7: 同脚本中抽查：恢复后 `customers` / `subscriptions` 行数与 `settings` 中某键值**等于备份文件内**的取值（证明落的是备份内容，不是原库）
  > 实测：C1（customers 7）、C2（subscriptions 3）、C3（settings `site_name`=`RESTORED-FROM-BACKUP`）均等于备份内取值；
  > C4 反向证明恢复前原库取值为 20 / 9 / `CURRENT-BEFORE-RESTORE`（三者确有不同 ⇒ 断言有区分力）；
  > C6 **恢复后 `app.db` 与备份文件 `sha256` 逐字节相同**。
- [x] AC-8: `backups-table.test.tsx` 新增三例通过：点击「导入备份」触发上传且带正确文件；点击「恢复」弹 ConfirmDialog，确认后调用恢复 mutation 且参数为文件名；`imp-` 文件渲染出「导入」标识
  > 实测：`vitest run --browser.headless src/features/backups/components/backups-table.test.tsx` → **8 passed (8)**（既有 5 例一字未改 + 新增 3 例）。
  > 导入例经隐藏 `input[type=file]` 用 `userEvent.upload` 触发；该 API 会重建 File 实例，故按 name/size 断言而非引用相等。
- [x] AC-9: 下载端点调用后 `logs` 新增一条 module=`backup` 的记录，且响应头含 `Cache-Control: no-store`；保留策略删除失败时 `logs` 出现 `error` 级记录
  > **前半已通过**：冒烟 19.21（`logs` module=`backup` 含「下载备份 <name>」）、19.20（含「导入备份 <name>」）、19.22（响应头 `cache-control: no-store`）全绿。
  > **后半「未复现」**：保留策略删除失败的 `error` 级日志**未实测**。复现需同时满足 ① 让 `unlinkSync` 失败（Windows 下只有**只读文件**可靠，目录只读并不阻止删其内文件）与 ② 让 `BACKUP_KEEP` 小于现有份数以触发删除 —— 而冒烟第 18 段的保留策略断言依赖 `keep=7`，改 env 需重启服务端，会破坏同轮对照。故按 AC-9 允许的口径**如实记录「未复现」，不写「已通过」**。
  > 该代码路径已实现（`services/backup.ts` `applyRetention()` catch 内 `writeLog('error','backup',…)`），但**无测试覆盖**，见 Known Issues 第 7 条。
- [x] AC-10: 冒烟新增段（19.x）全绿：导入成功/三类失败/恢复前置校验/恢复排程与 `policy.restoreAutoExit` 断言；且既有段失败集与基线逐字相同（基线见 Known Issues 第 1 条）
  > 实测（`SMOKE_BASE_URL=http://127.0.0.1:3002 SMOKE_DB_DIR=E:/AiData`，服务端 `RESTORE_AUTO_EXIT=false` + mock Telegram/飞书）：
  > **19.1~19.22 全绿**；总计 **176 通过 / 7 失败**。
  > **既有段失败集与基线逐字相同**：7 项失败全为 TASK-046 遗留的流量阈值段（客户 A/B 6 项 + 仪表盘 1 项），名称与 Known Issues 第 1 条基线一致。
  > 交叉验证：把 **`main` 上的原版 `smoke.ts`** 指向**同一服务端**再跑一遍，得 **154 通过 / 7 失败**，7 项失败**逐字相同** ⇒ 既有段结果未被本任务改变；176 − 154 = 22 = 新增用例数。
  > 附注：TASK-049 档案亦记录过「基线 152 / 分支 154」的 2 项差异（DB 状态相关的跳过分支），与本任务无关。
- [x] AC-11: 文档四件套同步且**无失效的否定性断言**：`api-contract.md` 两新端点 + `policy.restoreAutoExit`；`overview.md` §12.8 的「不做应用内一键恢复」已改写为实际形态；`backup-restore.md` §3 改为「应用内恢复（推荐）+ 手工兜底」；`.env.example` 增 `RESTORE_AUTO_EXIT` 说明
  > 四件套均已改写；原两处失效否定性断言（`overview.md:604`、`backup-restore.md:42`）已不存在。
  > 全仓否定性断言清扫（`grep -rn "不做.*恢复\|无恢复\|零实现\|一键恢复\|不支持导入"`，排除 `tasks/`）：无残留。
  > 残留一处**已标注的历史快照**：`tasks/done/TASK-015-system-backup/TASK.md` Non-Scope「不做恢复功能」——那是 TASK-015 **当时的范围决定**（且明说「不做成一键按钮」），作为历史记录为真；本档案 Background 已加「基线快照已被本任务推翻」的显式标注，见 Known Issues 第 8 条。
- [x] AC-12: D13-C 回写：TASK-047 / 048 / 049 的 `Merge Record` 九要素按 `gh` 实测值填写（`gh api repos/:owner/:repo/pulls/<N>` 可复现），`Status: REVIEW → DONE`，目录 `review/ → done/`；`python scripts/audit-repo.py` F8 / F9 通过
  > 三档九要素全部以 `gh api` / DockerHub Tags API **实测**填入（PR #22 / #23 / #24、提交数 13 / 3 / 3、`merged_at`、`merge_commit_sha`、CI / Docker run id、`sha-*` 镜像 tag 与 digest、审查记录指针）。
  > 顺带更正两处档案失真：① TASK-048 原写「PR 待回填（未推送，分支仅存在于本地）」与实测不符（PR #23 确已合并）；② 三档 `Next Action` / `Current State` 仍指向「待人类授权合并」，已改为终态描述（§13 否定性断言复核）。
  > 三档 `Status → DONE`、目录 `review/ → done/`（`git mv`）。`audit-repo.py`：**PASS=9 FAIL=0 WARN=0**（F8 / F9 均 PASS）。
- [x] AC-13: 门禁全绿：`pnpm exec eslint`（改动文件）/ `pnpm exec prettier --check`（改动文件）/ `pnpm exec tsc -b` / `pnpm --filter server typecheck` / 前端单测 / `python scripts/audit-repo.py`；`git status --short` 仅含 File Scope 内文件
  > `eslint` 15 个改动/新增文件 → 退出码 0；`knip` → 零输出（CI 的 knip 步骤，见下）；`prettier --check` 同批文件 → 全部合规；`tsc -b` → 0；`--filter server typecheck` → 0；
  > 前端单测**全量** **26 文件 / 334 用例全通过**；`audit-repo.py` **PASS=9 FAIL=0**；`git diff --check` 无空白错误。
  > `git status --short` 仅含 File Scope 内文件（`__screenshots__` / `dist` 已被 `.gitignore:33` / `:11` 覆盖）。
  > 附加（非门禁项）：`server/scripts/*.ts` 不在 `server/tsconfig.json` 的 `include: ["src"]` 内，故不经 `typecheck` 门禁；已**手工**以相同编译器选项对 `smoke.ts` 与 `restore-apply-check.ts` 各跑一次 `tsc --noEmit`，新增代码**零错误**（`smoke.ts` 残留的 2 处 `boolean | undefined` 报错在未改动的 `main` 上同样存在，非本任务引入）。

---

## File Scope

```yaml
File Scope:
  # ---- 共享类型 ----
  - shared/src/schema/entities.ts            # backupImportResultSchema / backupRestorePlanSchema
  # ---- 后端 ----
  - server/src/services/backup-naming.ts     # 新增：无依赖的文件名规则（含 (app|imp) 白名单）
  - server/src/services/backup-inspect.ts    # 新增（执行位补）：无项目内依赖的备份内容校验
                                              #   理由：Phase 2 原定把 assertImportableBackup 放
                                              #   services/backup.ts「供导入与恢复共用」，但
                                              #   Constraints 同时禁止 db/restore.ts import
                                              #   services/backup.ts（成环），而 Requirement 7
                                              #   又要求恢复启动期做同一套 integrity_check + 五表
                                              #   校验。三条要求只有抽到第三个零依赖模块才能同时
                                              #   满足（不复制校验逻辑、不成环）。
  - server/src/services/backup.ts            # 改：引用 naming；下载审计不在此处
  - server/src/db/restore.ts                 # 新增：标记读写 + 启动期应用（无 db 依赖）
  - server/src/db/index.ts                   # 改：new Database 之前调用 applyPendingRestore，导出 outcome
  - server/src/routes/backups.ts             # 改：import / restore 两端点 + download 审计与 no-store + policy 字段
  - server/src/index.ts                      # 改：启动后写 restore outcome 日志
  - server/src/env.ts                        # 改：restoreAutoExit（RESTORE_AUTO_EXIT，默认 true）
  - server/scripts/restore-apply-check.ts    # 新增：启动期应用的独立验证脚本（临时目录，退出码判定）
  - server/package.json                      # 改（执行位补，CI knip 门禁要求）：新增 restore-check 脚本。
                                              #   理由：knip 以 package.json scripts 为入口；独立验证脚本
                                              #   若不以 script 登记就会被判「未使用文件」而使 CI 红。
                                              #   顺带让 runbook 可用 pnpm --filter server restore-check 调用。
  - server/scripts/smoke.ts                  # 改：第 19 段（导入/恢复）
  # ---- 前端 ----
  - src/features/backups/queries.ts          # 改：uploadBackup / useRestoreBackup
  - src/features/backups/components/backups-table.tsx        # 改：导入按钮 + 恢复按钮 + imp- 标识 + 环境提示
  - src/features/backups/components/backups-table.test.tsx   # 改：新增三例
  # ---- 文档 ----
  - docs/technical/api-contract.md
  - docs/architecture/overview.md
  - docs/operations/backup-restore.md
  - .env.example
  # ---- 归档回写（Phase 5，仅 Merge Record / Status / 目录迁移）----
  - tasks/review/TASK-047-residual-debt-consolidation/**     # → done/
  - tasks/review/TASK-048-table-page-size-100/**             # → done/
  - tasks/review/TASK-049-subscription-search-customer-name/**  # → done/
  # ---- 任务档案自身 ----
  - tasks/backlog/TASK-050-backup-import-and-restore/**      # 领取后移入 active/，交付后移入 review/
Non-Scope (files):
  - server/src/db/schema.ts        # 无 schema 变更，不生成迁移
  - server/src/db/migrate.ts
  - docker-compose.yml             # restart 策略已具备
  - server/data/**                 # 禁止写入真实库
  - src/routes/_authenticated/backups/index.tsx  # 路由与页面骨架不变
  - src/components/layout/data/sidebar-data.ts   # 菜单项不变
  - .github/**
```

---

## Implementation Plan

### Phase 0 — 基线复核与领取

```bash
cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
git fetch origin
git rev-parse main origin/main     # 期望均为 dbb3698
git status --short                 # 期望为空
```

`git switch main && git pull --ff-only && git switch -c feat/TASK-050-backup-import-and-restore`；
任务目录移入 `tasks/active/`，`Status: READY → ACTIVE`，Meta 补 `Owner` / `Owner Since`。

### Phase 1 — 文件名规则抽离（先做，后续两侧共用）

新增 `server/src/services/backup-naming.ts`（**零 import**，避免任何环）：

```ts
/** 备份文件名白名单（同时用于防路径穿越）。app- = 本机生成，imp- = 外部导入 */
export const BACKUP_FILENAME_RE = /^(?:app|imp)-\d{8}-\d{6}-\d{3}\.db$/
/** 恢复前自动生成的回退副本前缀（刻意不进白名单：不被列表展示、不被保留策略删除） */
export const PRE_RESTORE_PREFIX = 'pre-restore-'
export function buildBackupFilename(prefix: 'app' | 'imp', now: Date): string { /* 同 TASK-015 格式化 */ }
export function buildPreRestoreFilename(now: Date): string { /* `${PRE_RESTORE_PREFIX}${ts}.db` */ }
```

`services/backup.ts` 改为引用上述常量（删除本地 `FILENAME_RE` 与 `timestampFilename`）。

> **注意**：`applyRetention()` 只对白名单内文件生效，故 `pre-restore-*` 天然免于删除——
> 这是**刻意**行为，须在 `backup-restore.md` 写清（回退副本需人工清理）。

### Phase 2 — 导入

1. `server/src/routes/backups.ts` 增 `POST /import`（放在 `GET /` 之后、`/:filename/download` 之前）：

   ```ts
   const IMPORT_MAX_BYTES = 64 * 1024 * 1024
   const SQLITE_MAGIC = 'SQLite format 3\u0000'
   const REQUIRED_TABLES = ['admins', 'customers', 'subscriptions', 'settings', 'logs']

   backupRoutes.post('/import', async (c) => { /* 见校验链 Requirement 2 */ })
   ```

   流程：读 `content-length` 预判 → `await c.req.arrayBuffer()` → 长度/魔数校验 →
   写 `<final>.part` → 只读打开做 `integrity_check` 与表名子集校验 → `rename` →
   `sha256` → 审计日志 → 201。**任何 throw 都要在 catch 里 `unlink` 临时文件**。

2. 校验函数独立成 `assertImportableBackup(path: string): void`（供导入与恢复共用，
   放在 `services/backup.ts`；它依赖 better-sqlite3 但不依赖 db 单例，注意 `new Database(file, { readonly: true, fileMustExist: true })` 后必须 `close()`）。

3. `shared/src/schema/entities.ts` 增：

   ```ts
   export const backupImportResultSchema = z.object({
     item: backupFileSchema,
     origin: z.string().nullable(),
     sha256: z.string(),
   })
   export const backupRestorePlanSchema = z.object({
     scheduled: z.boolean(),
     filename: z.string(),
     restartExpected: z.boolean(),
   })
   ```

   `pnpm build:shared` 后再改后端/前端（顺序不可反）。

### Phase 3 — 恢复（核心）

1. `server/src/db/restore.ts`（**只 import `node:fs` / `node:path` / `better-sqlite3` / `../env.js`**）：

   ```ts
   export type RestoreMarker = { filename: string; requestedAt: string; requestedBy: string }
   export type RestoreOutcome =
     | { status: 'applied'; filename: string; preRestoreCopy: string }
     | { status: 'failed'; filename: string; error: string }

   export function restoreMarkerPath(dbPath: string): string
   export function writeRestoreMarker(dbPath: string, filename: string): void
   export function applyPendingRestore(dbPath: string): RestoreOutcome | null
   ```

   `applyPendingRestore` 严格按 Requirement 7 的 ①~⑥ 顺序执行，且**先做全部前置校验**
   （白名单正则 + 目标文件存在 + `integrity_check` + 五表）再动文件；任何一步失败走回滚分支。

2. `server/src/db/index.ts`：

   ```ts
   import { applyPendingRestore } from './restore.js'
   // …resolveDbPath / mkdirSync 之后、new Database 之前——
   // 必须在打开连接前完成替换，否则 WAL 会把旧数据写回，恢复静默失效。
   export const restoreOutcome = applyPendingRestore(dbPath)
   export const sqlite = new Database(dbPath)
   ```

3. `server/src/index.ts`：在 `void writeLog('info', 'system', '服务启动')` 之前，若
   `restoreOutcome` 非 null 则写 `logs`（applied → `warn`，failed → `error`），消息含
   `filename` 与 `preRestoreCopy`。

4. `server/src/env.ts`：`restoreAutoExit: process.env.RESTORE_AUTO_EXIT !== 'false'`。

5. `routes/backups.ts` 增 `POST /:filename/restore`：校验 → `writeRestoreMarker` →
   审计 → 202 → 若 `config.restoreAutoExit` 则 `setTimeout(() => process.exit(0), 1200)`
   （**先返回响应再退出**，延迟用于让响应与日志落盘；不得用 `process.exit` 前同步写响应）。
   同时 `GET /` 的 `policy` 增 `restoreAutoExit: config.restoreAutoExit`。

### Phase 4 — 前端

1. `queries.ts`：

   ```ts
   export async function uploadBackup(file: File): Promise<BackupImportResult>  // raw fetch, octet-stream + X-Backup-Filename
   export function useRestoreBackup()  // POST /backups/:filename/restore，body { confirm: filename }；成功后不 invalidate（进程将重启）
   ```

   > `api.post` 恒设 `Content-Type: application/json`（`src/lib/api.ts:55`），**不能**用于上传；
   > 与 `downloadBackup`（`queries.ts:54`）同法用原生 fetch。

2. `backups-table.tsx`：
   - 顶部按钮组加「导入备份」（`Upload` 图标 + 隐藏 `<input type="file">`；选择后先判
     `file.size > 64 * 1024 * 1024` 直接 toast 拒绝，再调 `uploadBackup`）；
   - 行内操作加「恢复」（`RotateCcw`，`text-amber-600`），点击置 `pendingRestore`；
   - 新增 `ConfirmDialog`（destructive，title「恢复备份」，desc 明示覆盖与重启后果，
     confirmText「恢复」）；成功后 toast：容器环境 2s 轮询 `/api/health` 最多 30s 再
     `window.location.reload()`，超时提示手动刷新；
   - 文件名列：`item.filename.startsWith('imp-')` 时在文件名后渲染
     `<span className='...'>导入</span>` 标识；
   - `data.policy.restoreAutoExit === true` 时表格上方渲染 `Alert`（提示本环境恢复后不会自动重启）。

3. `backups-table.test.tsx`：新增 `describe('BackupsTable 导入与恢复')` 三例。注意本仓库
   浏览器单测的既有约束：`render()` 结果**无** `getByRole`/`getByText`（用
   `document.querySelectorAll`）——但本文件既有 5 例已在用 `getByRole`，说明该版本支持；
   **以既有 5 例的写法为准**，若新用例取不到元素，改用 `document.querySelector` 定位，
   不得改写既有 5 例。

### Phase 5 — 归档回写（D13-C，独立提交）

对 TASK-047 / 048 / 049 逐个：

```bash
gh api repos/:owner/:repo/pulls/<N> --jq '{merged_at:.merged_at, merge:.merge_commit_sha}'
gh api repos/:owner/:repo/pulls/<N>/commits --jq 'length'
gh run list --commit <merge_sha> --limit 5 --json databaseId,conclusion,name
```

- 已知实测（2026-10-30 复核）：#22 → `9429b23`（2026-10-21T10:40:27Z）、
  #23 → `d229ce1`（2026-10-23T02:05:24Z）、#24 → `dbb3698`（2026-10-27T07:09:37Z）。
  **仍须以执行时 `gh` 输出为准**，不得直接照抄本行。
- 填九要素 → `Status: DONE` → `git mv tasks/review/<dir> tasks/done/<dir>`。
- 「审查记录」行：047/048 若确无合并前独立审查档，如实写「无（A3 断档）」；
  049 指向 `handoffs/2026-10-27-review.md`。

### Phase 6 — 收尾

验证 → 回填 Changed Files / Current State / Known Issues → 写交付 Handoff（developer → reviewer）
→ `Status: ACTIVE → REVIEW`、目录移入 `tasks/review/` → 推送分支、开 PR → **停下**。
档案与实现**同批提交**（KI-11），不得新开「入库专用」交接。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1~AC-5、AC-10 | 冒烟（快照库隔离） | ① `pnpm build:shared` ② 快照：`VACUUM INTO 'E:/AiData/task050-snapshot.db'`（源 `server/data/app.db`） ③ 起服务：`cd server && DATABASE_URL=E:/AiData/task050-snapshot.db PORT=3002 RESTORE_AUTO_EXIT=false node --import tsx src/index.ts`（**保持调度器启用**，否则 TASK-021 的 jobs 断言失败） ④ `SMOKE_BASE_URL=http://127.0.0.1:3002 pnpm --filter server smoke` |
| AC-6、AC-7 | 独立脚本 | `pnpm --filter server exec tsx scripts/restore-apply-check.ts`；脚本自建 `E:/AiData/task050-restore-*/` 工作区，**不触碰** `server/data/` |
| AC-8 | 浏览器单测 | `pnpm exec vitest run --browser.headless src/features/backups/components/backups-table.test.tsx` |
| AC-9 | 冒烟 + 日志查询 | 冒烟下载检查后 `GET /api/logs?module=backup&pageSize=5` 断言新增记录；响应头断言 `cache-control: no-store` |
| AC-11 | 人工目视 | 逐条比对四份文档与实现；**特别核对** `overview.md:604` 与 `backup-restore.md:42` 两处原「不做恢复」表述是否已改写并保留「为何改为重启式」的理由 |
| AC-12 | `gh` + 审计 | `gh api` 复现九要素；`python scripts/audit-repo.py`（期望 F8 / F9 PASS） |
| AC-13 | 静态门禁 | `pnpm exec eslint <改动文件>`、`pnpm exec prettier --check <改动文件>`、`pnpm exec tsc -b`、`pnpm --filter server typecheck`、`git diff --check`、`git status --short` |

**判定口径：** 「恢复成功」= AC-6 脚本退出码 0 且 AC-7 的数据断言为真；仅响应 202 不算恢复成功。
两项验证都必须留原始输出（含失败项明细）。

---

## Current State

> **2026-10-31 · `REVIEW`（`tasks/review/`）—— Phase 0~6 全部完成，PR #25 已开且 CI 全绿，等待独立审查与人类授权。**
> **PR #25**（base `main`，head `6b5b418`，7 提交 / 42 文件，`MERGEABLE`）：
> CI run **`41101392360`** 两个必需检查 `install-lint-build` 与 `audit` 均 **pass**
> （`gh pr checks 25` 可复现）。首轮 run `41099616120` 曾在 knip 步骤失败，
> 已由提交 `6b5b418` 修复后复跑转绿 —— 见 Task Rules 末条与 AC-13。
> **执行位未合并、未打 tag、未自行判定 PASS。**
> 13 项 AC 全部按实测结论勾选（其中 AC-9 后半「未复现」、已如实标注）；冒烟 176 通过 / 7 失败
> （7 项为 TASK-046 遗留基线，失败集逐字相同）；`restore-apply-check.ts` 20 通过 / 0 失败；
> 前端单测 26 文件 / 334 用例全通过；静态门禁与 `audit-repo.py` 全绿。
> **恢复成功已有数据层证据**（AC-7 的 sha256 逐字节相同 + 行数/键值比对，以及一次经真实
> 服务启动路径的端到端验证：18 → 17 客户、哨兵行消失、`pre-restore-*` 生成、`logs` 落
> module=`restore` 的 applied 记录）。执行位**未合并、未打 tag、未自行判定 PASS**。
>
> 2026-10-30：主控位完成现状核查（导出完整 / 导入与恢复零实现）并起草本任务，`Status: READY`，
> 待执行位领取。所有设计结论以 `main dbb3698` 为实测基线。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `server/src/services/backup-naming.ts` | **新增** | 零依赖文件名规则：`BACKUP_FILENAME_RE`（`app`/`imp` 双前缀）、`PRE_RESTORE_PREFIX`、`buildBackupFilename` / `buildPreRestoreFilename` / `isBackupFilename`。同时被 `services/backup.ts`（运行期）与 `db/restore.ts`（启动期）引用，故刻意零 import 以避开「restore → backup → db/index → restore」环 |
| `server/src/services/backup-inspect.ts` | **新增** | 零项目内依赖的备份内容校验：`assertImportableBackup()` + `REQUIRED_BACKUP_TABLES` + `BackupValidationError`。导入端点与恢复启动期共用同一套 `integrity_check` + 五表校验 |
| `server/src/db/restore.ts` | **新增** | 恢复标记读写 + 启动期应用。`applyPendingRestore(dbPath)` 严格按 ①~⑥ 顺序，先做全部前置校验再动文件；失败分支回滚 rename、保留标记。含「为何不做热替换」的架构说明 |
| `server/scripts/restore-apply-check.ts` | **新增** | 启动期恢复的独立验证脚本（AC-6 / AC-7）。在 `E:/AiData/task050-restore-check-*/` 自建场景，20 项断言，退出码判定 |
| `server/src/db/index.ts` | 改 | `new Database` **之前**调用 `applyPendingRestore(dbPath)` 并导出 `restoreOutcome`；附「为何必须在打开连接前」的注释 |
| `server/src/index.ts` | 改 | 启动后消费 `restoreOutcome` 写 `logs`（applied→`warn`、failed→`error`，module=`restore`）+ 控制台一行。放在 `服务启动` 日志之前 |
| `server/src/env.ts` | 改 | 新增 `restoreAutoExit`（env `RESTORE_AUTO_EXIT`，默认 `true`） |
| `server/src/routes/backups.ts` | 改 | 新增 `POST /import`（八位字节流 + 四层校验 + `.part` 原子入列 + sha256 + 审计）与 `POST /:filename/restore`（前置校验 + 标记 + 202 + 延迟退出）；下载端点补 `Cache-Control: no-store` 与审计；`GET /` 的 `policy` 补 `restoreAutoExit`；`Hono` 加 `BackupEnv` 类型以取 `c.get('auth')` |
| `server/src/services/backup.ts` | 改 | 删除本地 `FILENAME_RE` 与 `timestampFilename`，改引 `backup-naming.ts`；`applyRetention()` 删除失败补 `writeLog('error','backup',…)`（AC-9 后半，**未复现**） |
| `server/scripts/smoke.ts` | 改 | 新增第 19 段（22 项）：导入成功/三类失败/缺表库拒绝/无残留/恢复前置校验四项/排程与标记/进程未退出/清理/导入与下载审计/`no-store`；新增 `reqRaw`（八位字节流）与 `downloadBackupBytes`（ArrayBuffer，避免 UTF-8 解码破坏 SQLite 高位字节）；新增 `SMOKE_DB_DIR` 环境变量说明（恢复标记清理） |
| `src/features/backups/queries.ts` | 改 | 新增 `uploadBackup()`（原生 fetch + octet-stream + `X-Backup-Filename`）、`useRestoreBackup()`、`BACKUP_IMPORT_MAX_BYTES` 常量 |
| `src/features/backups/components/backups-table.tsx` | 改 | 「导入备份」按钮 + 隐藏 file input + 前端 64 MiB 预检；行内「恢复」按钮 + destructive ConfirmDialog；202 后 toast + 2s/30s 健康轮询 + 刷新；`imp-` 文件的「导入」标识；`restoreAutoExit === true` 时的环境提示 Alert |
| `src/features/backups/components/backups-table.test.tsx` | 改 | mock 补 `useRestoreBackup` / `uploadBackup`；新增 `describe('BackupsTable 导入与恢复')` 三例。既有 5 例**一字未改** |
| `shared/src/schema/entities.ts` | 改 | `backupPolicySchema` 补 `restoreAutoExit`；新增 `backupImportResultSchema` 与 `backupRestorePlanSchema` |
| `docs/technical/api-contract.md` | 改 | 「系统备份」节补 import / restore 两端点、`BackupPolicy` 三字段、导入四层校验表、恢复请求/响应与启动期语义 |
| `docs/architecture/overview.md` | 改 | §12.8 改写为「导出 + 导入 + 恢复」三能力；删去「不做应用内一键恢复」的失效否定性断言，改为记录「标记 + 重启后应用」的实际形态与理由、`pre-restore-*` 为何不进白名单 |
| `docs/operations/backup-restore.md` | 改 | §3 改为「应用内恢复（推荐）+ 手工兜底」；新增 §3.3 导入异地备份、§3.4 回退副本与清理；§1/§2 补导入/恢复/`RESTORE_AUTO_EXIT`；§6 补 6 行新故障模式 |
| `.env.example` | 改 | 新增 `RESTORE_AUTO_EXIT` 说明（默认值、两种行为、本地 `tsx watch` 不自启） |
| `tasks/done/TASK-047-residual-debt-consolidation/TASK.md` | 改 + 迁移 | `Merge Record` 九要素按 `gh` 实测回填；`Status: REVIEW → DONE`；`Current State` / `Next Action` 改终态；`review/ → done/` |
| `tasks/done/TASK-048-table-page-size-100/TASK.md` | 改 + 迁移 | 同上；并更正原「PR 待回填（未推送，分支仅存在于本地）」的失真（PR #23 确已合并） |
| `tasks/done/TASK-049-subscription-search-customer-name/TASK.md` | 改 + 迁移 | 同上 |
| `tasks/review/TASK-050-backup-import-and-restore/**` | 新增 + 迁移 | 任务档案与交接（领取后 `backlog/ → active/`，交付后 `active/ → review/`） |

---

## Known Issues

1. **冒烟存量失败（非本任务引入）**：TASK-046 语义变更后，`smoke.ts` 的流量阈值段落
   （客户 A/B 6 项 + 仪表盘 1 项 = 7 项）在**未改动的 `main` 上同样失败**，
   根因见 `tasks/review/TASK-049-.../TASK.md` Known Issues 第 1 条。
   本任务的冒烟判据是**失败集与基线逐字相同**（基线：152 通过 / 7 失败，2026-10-27 实测），
   不是「全绿」。若新增失败项，必须先排除是否由本任务引入。
2. **本地 `tsx watch` 不会因恢复而自启**：`process.exit(0)` 后 `tsx watch` 不重启进程，
   恢复不会自动应用。这是环境事实，不是缺陷；容器有 `restart: unless-stopped` 才是
   生产路径。UI 与 runbook 必须明示（Requirement 10 / AC-11）。
3. **`.env` 不在备份快照内**：换机器恢复时 `JWT_SECRET` / `ADMIN_PASSWORD` 仍取目标机
   的 `.env`，历史会话 token 会失效、管理员口令以目标环境为准。恢复后需重新登录，属预期。
4. **`pre-restore-*` 副本不会被自动清理**：刻意排除在保留策略之外（保回退能力），
   长期使用会在 `backups/` 累积，需人工清理。runbook 须写明。
5. **导入不追溯来源**：`X-Backup-Filename` 仅入 `logs`，落盘统一为 `imp-<时间戳>.db`。
   故意不采用上传方文件名（防路径穿越与不可控字符）。若需溯源，查 `logs` 的 `origin` 字段。
6. **`server/scripts/*.ts` 不经 `typecheck` 门禁**：`server/tsconfig.json` 的 `include` 只有
   `["src"]`，故 `smoke.ts` 与新增的 `restore-apply-check.ts` 都不被 `pnpm --filter server
   typecheck` 覆盖（既有状况，非本任务引入）。本任务已**手工**以相同编译器选项各跑一次
   `tsc --noEmit`：新增代码零错误；`smoke.ts` 残留 2 处 `boolean | undefined` 报错在未改动的
   `main` 上同样存在。若要把脚本纳入门禁须改 `include`，属跨任务的基础设施改动，本任务不做。
7. **保留策略删除失败的 `error` 日志无测试覆盖**（AC-9 后半「未复现」）：代码路径已实现
   （`services/backup.ts` `applyRetention()` catch 内 `writeLog('error','backup',…)`），但复现
   需要 ① 让 `unlinkSync` 失败（Windows 下只有只读**文件**可靠）且 ② `BACKUP_KEEP` 小于现有
   份数；而冒烟第 18 段的保留策略断言依赖 `keep=7`，改 env 需重启服务端、破坏同轮对照。
   **本任务未实测该路径，不得据此认为它已生效。**
8. **`tasks/done/TASK-015-system-backup/TASK.md` 的 Non-Scope 仍写「不做恢复功能」**：
   那是 TASK-015 **当时的范围决定**（且原文明说「不做成一键按钮」），作为历史记录为真，
   故**未改动已归档档案**（改动它超出本任务 File Scope）。已在 TASK-050 本档案 Background
   加「基线快照已被本任务推翻」的显式标注，避免读者把它当成当前能力声明。
   若审查认为应回补指针，属独立小改动。
9. **`E:/AiData/task050-restore-check-*/` 工作区未清理**：`restore-apply-check.ts` 刻意保留
   现场供人工复查（脚本末尾打印路径）。长期累积需人工删除。
10. **端到端恢复验证用的一次性脚本未入库**：为证明「经 `db/index.ts` 启动路径生效」
    （而非仅单元级），执行位在 `E:/AiData/task050-e2e/` 起了一次真实服务、走 API 排程恢复、
    重启后复核数据（18 → 17 客户、哨兵行消失、`logs` 落 applied 记录），完成后已清理该目录。
    该脚本为临时取证用，**不在 File Scope 内故未入库**；其覆盖的能力已由
    `restore-apply-check.ts`（20 项断言）持续保障，但**「真实服务启动路径」这一层没有
    常驻自动化覆盖** —— 若审查认为需要，应另立任务补一个启动级集成测试。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | coordinator | implementer | 2026-10-30 | 派单：现状核查结论 + 设计定稿（重启式恢复）+ 分相实施计划 + 归档回写 |
| 002 | implementer | reviewer | 2026-10-31 | 交付：Phase 0~6 与 AC-1~AC-13 全部完成并留证；5 条与设计的偏离；3 项需审查位特别核实的问题 |

**最新 Handoff：** `handoffs/HANDOFF-002-implementer-to-reviewer.md`
**Next Action：** 独立审查位（不携带实现上下文的新实例）按 AC-1~AC-13 复核并给出 PASS / FAIL；
**执行位已停下，未合并、未打 tag、未自行判定 PASS。**

---

## Merge Record

> **本节不随「Pass/收尾」填写。** 按 D13-C 选项 C（`.agents/rules/github.md` §2 / §6、
> `AGENTS.md` §14.2），本表由**下一个任务**在回收本任务归档时回填；
> 在此之前任务保持 `Status = REVIEW`、留在 `tasks/review/`（机制，非遗漏）。
> **禁止在本任务内自我回写**（那会造成档案与提交历史不一致）。
> 回填时九要素必须填实测值（可被 `gh api` / Tags API 复现），不得沿用档案自述；
> 无合并前独立审查档时，「审查记录」行须如实写「无（A3 断档）」，**不得补写、不得伪造**。

| 要素 | 值 |
|------|-----|
| PR | 待回填 |
| 合并策略 | rebase-merge（`AGENTS.md` §14.2 默认） |
| 提交数 | 待回填 |
| merged_at | 待回填 |
| merge_commit_sha | 待回填 |
| 合并后 CI run | 待回填 |
| 合并后 Docker run | 待回填 |
| 镜像 tag | 待回填 |
| 审查记录 | 待回填 |

---

## Task Rules

- [补充] 验证只允许使用快照库与 `E:/AiData/` 下的临时目录，**禁止**在 `server/data/app.db` 上
  执行导入/恢复，**禁止**向真实库写入测试行。
- [补充] 冒烟服务端必须保持调度器启用（默认），不得设 `ENABLE_SCHEDULER=false`；
  且必须设 `RESTORE_AUTO_EXIT=false`，否则第 19 段会杀掉冒烟服务端自身。
- [补充] 任何「恢复成功」的断言必须同时有数据层证据（AC-7），不得仅有 202 响应。
- [补充] 任务档案与交接文件随实现**同批提交**（KI-11），不新开「入库专用」交接。
- [补充] Phase 5 只允许填**实测值**；不确定的字段宁可留「待回填」并上报，不得猜测。
- [补充] **CI knip 门禁要求零新增未使用导出/未使用文件**（`knip.config.ts` 的「新增积压仍会红」策略）。
  据此执行位做了三处收窄：`REQUIRED_BACKUP_TABLES` 与 `RestoreMarker` 由 `export` 改为模块内可见
  （二者均无跨模块消费者，导出即死代码）；`restore-apply-check.ts` 经 `server/package.json`
  的 `restore-check` 脚本登记为 knip 入口，并改为复用 `restoreMarkerPath` 与 `PRE_RESTORE_PREFIX`
  （单一事实来源，不再硬编码字面量）。**行为零变化**，仅收窄导出面。

---

## Notes

- **为什么恢复不做热替换**：`db/index.ts:27` 的连接在模块加载期建立，`db` 实例（`:35`）与
  `logger.ts:1` 等引用全部绑定该对象；运行期 close 后无法安全重建全部引用。重启式换文件
  还顺带保证了「必须删 `-wal`/`-shm`」这条最易漏的硬性要求。备选方案（`ATTACH` + 逐表
  `INSERT ... SELECT`）被否：需枚举 12 张表、处理外键顺序与 `sqlite_sequence`，任何遗漏都是
  静默数据不一致，且无法复用 runbook 已验证的文件级语义。
- **为什么 `imp-` 用独立前缀而不是复用 `app-`**：文件名是唯一能在重启后存活、且不依赖 DB
  的溯源信息（恢复场景下 `logs` 可能正被覆盖）。独立前缀让「这是外部导入」一眼可辨，
  同时不扩大白名单的攻击面（仍是严格定长正则）。
- **为什么 `pre-restore-*` 不进白名单**：进白名单就会被 `applyRetention()` 当旧备份删掉，
  恰好在「恢复失败想回退」时失效。代价是需人工清理，已在 Known Issues 第 4 条登记。
- **为什么校验链要求五张表**：`integrity_check` 只证明页结构完好，不证明「这是我们系统的库」。
  缺表校验会让一个无关 SQLite 库通过导入并被用于恢复，症状是启动即崩或数据全空。
- **导入上限 64 MiB 的取值依据**：现有库为 MB 级（`backupFileSchema.size` 实测见列表），
  64 MiB 留足余量且能挡住误传大文件；不引入新 env 变量以控制复杂度，若将来超限再参数化。
- **恢复的原子性边界**：`rename` + `copy` 不是跨文件事务。若在 ③ 与 ④ 之间崩溃，会留下
  「新 `app.db` + 旧 `-wal`」，下次启动会因 WAL 不匹配触发回滚或损坏——因此 ④ 必须紧贴 ③，
  且失败路径必须删掉已复制的 `app.db`（改回 `rename` 的原文件）。这条是本次实现最易出错的点，
  代码里要有显式注释。

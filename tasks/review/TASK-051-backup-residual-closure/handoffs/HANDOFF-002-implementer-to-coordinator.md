# HANDOFF-002 — 执行位 Implementer → 主控位 Coordinator（交付）

---

## Meta

```yaml
From: Codex (执行位 Implementer)
To: 主控位 Coordinator
Task: TASK-051 — 备份残留收口：D13-C 回写 + 目录注入 + 启动级端到端 + 保留策略失败留痕
Date: 2026-10-31
Current State: REVIEW
Previous Handoff: HANDOFF-001-coordinator-to-implementer.md（派单）
基线: main 2fdd2c9（TASK-050 已合并，已发 v1.0.6）
分支: feat/TASK-051-backup-residual-closure
提交: bb5d424（WP-0）→ cb5e750（WP-1）→ 91b7149（WP-3）→ 065be7f（WP-2）
```

**基线复核（Phase 0，按派单执行）**：

```text
$ git rev-parse --short main
2fdd2c9                                   ✅ 与派单一致
$ git status --short
?? tasks/backlog/TASK-051-backup-residual-closure/   ✅ 仅本任务目录（untracked）
$ pnpm --filter server restore-check
结果：24 通过 / 0 失败                    ✅ 退出码 0
```

（本机需加 `--config.verify-deps-before-run=false`，否则 pnpm 包装器的 deps-status 检查在非 TTY
下中止；跑的是同一脚本、同一份代码。所有 pnpm 命令在下文均省略该参数书写。）

---

## 一、两处与派单的偏差（先说明，请审查位重点核对）

### 偏差 1：`resolveBackupFile` 去掉了 `dbPath` 形参

派单给的签名是 `resolveBackupFile(dbPath, filename, backupDir)`。改完之后 `dbPath` 在该函数内
**没有任何读取点**（目录完全来自入参），而本仓 eslint 配的是
`@typescript-eslint/no-unused-vars: ['error', { args: 'all' }]` —— 留着即报错，
R9（门禁全绿）直接挂。故改为：

```ts
function resolveBackupFile(filename: string, backupDir: string): string | null
```

该函数是**模块内私有**（无 `export`），`grep` 全仓只有一个调用点（`restore.ts:121`），
不影响任何外部调用面。`applyPendingRestore(dbPath, backupDir)` 与派单**逐字一致**。

### 偏差 2：e2e 子进程用 `node --import tsx` 而非 `pnpm --filter server exec tsx`

派单允许「自行选能做到的方案并记录」。选它的原因：本机 pnpm 包装器对 workspace 命令触发
deps-status 检查并在非 TTY 下中止，子进程里无法稳定传
`--config.verify-deps-before-run=false`（`spawn` 传 pnpm 会直接失败）。
`node --import tsx src/index.ts` 是同一解释器、同一份源码、跨平台一致。
顺带：`taskkill /T /F` 在本沙箱返回 `Access denied`（详见 Known Issues 第 2 条），
故进程回收改用 `child.kill('SIGTERM')` → 宽限 8s → `process.kill(pid,'SIGKILL')`。

---

## 二、WP-0：D13-C 回写（独立提交 `bb5d424`，最先做）

`tasks/review/TASK-050-backup-import-and-restore/TASK.md` 的 `Merge Record` 九要素，
**逐项 `gh api` / DockerHub Tags API 实测**，未抄派单或档案自述：

| 要素 | 实测命令 | 输出 |
|------|---------|------|
| PR | `gh api repos/…/pulls/25 --jq '{merged,merged_at,sha,commits,title,base}'` | `{"base":"main","commits":16,"merged":true,"merged_at":"2026-10-31T01:37:54Z","number":25,"sha":"2fdd2c93bbea0ff4ec8bf3a763ede79f24e9d30a","title":"feat(TASK-050): 备份导入与备份恢复，闭合容灾链下游"}` |
| 合并策略 | 同上 `.merged=true`；rebase-merge 为 `AGENTS.md` §14.2 默认 | 3 行说明已入表 |
| 提交数 | `gh api repos/…/pulls/25/commits --jq 'length'` | `16`（`.changed_files=48`、`.additions=4249`、`.deletions=143`） |
| merged_at | `gh api …/pulls/25 --jq .merged_at` | `2026-10-31T01:37:54Z` |
| merge_commit_sha | `gh api …/pulls/25 --jq .merge_commit_sha` | `2fdd2c93bbea0ff4ec8bf3a763ede79f24e9d30a` |
| 合并后 CI run | `gh api "repos/…/actions/runs?head_sha=2fdd2c93…"` | `41156271179  Continuous Integration  push  main  success  2026-10-31T01:37:57Z` |
| 合并后 Docker run | 同上 | `41156271209  Build and Push Docker Image  push  main  success  2026-10-31T01:37:57Z` |
| tag 触发的 run | `gh api …/actions/runs/41158945149 --jq '{id,name,event,head_branch,conclusion,created_at}'` | `{"conclusion":"success","created_at":"2026-10-31T02:12:39Z","event":"push","head_branch":"v1.0.6","id":41158945149}` —— 已明确标注为**发布 run 而非合并 run** |
| 镜像 tag | DockerHub Tags API | `sha-2fdd2c9` / `v1.0.6` / `latest` 三者 digest 同为 `sha256:edd1338b784f205bae677d012089abee8793938962d1706d884d34778fdecf5f`，`tag_last_pushed 2026-10-31T02:18:5xZ` |
| 审查记录 | 三份文件路径 | `handoffs/2026-10-31-coordinator-review.md`、`2026-10-31-coordinator-review-round2.md`、`2026-10-31-review.md`（I2） |

补充实测：`gh api …/git/refs/tags/v1.0.6` → tag object `c571798f`（annotated）；
`gh api …/git/tags/c571798f…` → `.object.sha = 2fdd2c93bbea0ff4ec8bf3a763ede79f24e9d30a`
（与 merge_commit_sha 逐字相同，已写入 Merge Record 该行）。

其余动作：`Status: REVIEW → DONE`；`git mv tasks/review/TASK-050-… tasks/done/…`；
`Current State` 追加终态行；`Next Action` 改终态且**未写死 head/提交数**（KI-11）。
提交后立即复跑 `python scripts/audit-repo.py` → **PASS=9 FAIL=0**（F8/F9 复核迁移后位置与编号唯一性）。

`projects/README.md`：**项目内不存在该文件**；workspace 级
`E:/NDLDSN-WORKSPACE/projects/README.md` 有一份 2026-10-21 的快照（`tasks/done/` 共 46 个），
但 ① 它不在本仓库 File Scope 内、② 自 TASK-048 起就未再随任务同步。故**未改**，在此说明。

---

## 三、WP-1：备份目录注入（提交 `cb5e750`）

### 3.1 改动

- `server/src/db/restore.ts`：`applyPendingRestore(dbPath, backupDir)`；删除
  `resolveBackupDir()`；`resolveBackupFile(filename, backupDir)`（见偏差 1）。
- `server/src/db/index.ts`：`import { config } from '../env.js'`；`backupDir` 单一推导后注入：

```ts
const backupDir = config.backupDir
  ? resolve(config.backupDir)
  : join(dirname(dbPath), 'backups')

export const restoreOutcome: RestoreOutcome | null = applyPendingRestore(dbPath, backupDir)
```

- `server/scripts/restore-apply-check.ts`：4 个调用点补第二实参。

### 3.2 AC-4 / AC-5 全量调用点核对（R5）

```text
$ git grep -n "applyPendingRestore\|resolveBackupFile" -- server/src server/scripts
server/scripts/restore-apply-check.ts:13: *   A. 无标记 → `applyPendingRestore` 返回 null 且**零文件副作用**；
server/scripts/restore-apply-check.ts:36:  applyPendingRestore,
server/scripts/restore-apply-check.ts:183:    const outcome = applyPendingRestore(DB_PATH, BACKUP_DIR)
server/scripts/restore-apply-check.ts:207:    const outcome = applyPendingRestore(DB_PATH, BACKUP_DIR)
server/scripts/restore-apply-check.ts:285:    const outcome = applyPendingRestore(DB_PATH, BACKUP_DIR)
server/scripts/restore-apply-check.ts:322:    const outcome = applyPendingRestore(DB_PATH, BACKUP_DIR)
server/src/db/index.ts:8:import { applyPendingRestore, type RestoreOutcome } from './restore.js'
server/src/db/index.ts:57:export const restoreOutcome: RestoreOutcome | null = applyPendingRestore(dbPath, backupDir)
server/src/db/restore.ts:114:export function applyPendingRestore(
server/src/db/restore.ts:121:  const backupPath = resolveBackupFile(marker.filename, backupDir)
server/src/db/restore.ts:219:function resolveBackupFile(filename: string, backupDir: string): string | null {

$ git grep -n "process.env.BACKUP_DIR" -- server/src/db/restore.ts
（零命中，grep 退出码 1）

$ git grep -n "config.backupDir" -- server/src/db/index.ts
server/src/db/index.ts:6:// 必须在本模块之前求值：`config.backupDir` 是备份目录的唯一推导来源。
server/src/db/index.ts:35: * `config.backupDir` 已配置（含 `.env` 经 `env.ts` 加载）则 `resolve()` 之，
server/src/db/index.ts:43:const backupDir = config.backupDir
server/src/db/index.ts:44:  ? resolve(config.backupDir)
```

逐点「参数名 → 值来源」表：

| 调用点 | 第 1 参 `dbPath` | 第 2 参 `backupDir` |
|--------|------------------|---------------------|
| `restore-apply-check.ts:183/207/285/322` | `DB_PATH` = `join(WORK,'data','app.db')`（临时库） | `BACKUP_DIR` = `join(WORK,'data','backups')`（临时备份目录，脚本既有常量） |
| `db/index.ts:57` | `dbPath` = `resolveDbPath()`（本模块内由 `process.env.DATABASE_URL` 推导） | `backupDir` = 本模块 `:43` 由 `config.backupDir` 推导 |
| `restore.ts:121`（内部） | — | 直接透传 `applyPendingRestore` 的入参 |

**顺序正确性**：两参同为 `string`，写反不报错——上表逐点核对，`dbPath` 一律指向 `.db` 文件、
`backupDir` 一律指向目录；另由 3.3 的红/绿实测兜底（若写反，恢复会因「备份文件不存在」失败）。

### 3.3 红/绿实测（`db:migrate` 入口，隔离环境）

场景：仓库根 `.env` 提供 `BACKUP_DIR`（不设 `DATABASE_URL`），`DATABASE_URL` 以 OS env 传入，
库与目录均在 `E:\NDLDSN-WORKSPACE\.i2-review-tmp\task051\wp1-migrate\`。
9 份白名单场景改为：现库 3 客户、备份 7 客户、标记指向该备份。

**红（修复前代码，`git checkout HEAD -- restore.ts index.ts`）：**

```text
$ pnpm --filter server db:migrate
[db] migrations applied → …\wp1-migrate\data\app.db
MIGRATE_RED_EXIT=0                      ← 退出码 0，没有任何报错
$ node count.cjs
data/app.db → customers = 3            ← 现库未被替换
backups/imp-20261031-120000-000.db → customers = 7
$ Test-Path data/.restore-pending.json
True                                  ← 标记未被消费
（backups/ 下无 pre-restore-*）        ← 恢复根本没发生，且无任何日志
```

**绿（修复后代码）：**

```text
$ pnpm --filter server db:migrate
[db] migrations applied → …\wp1-migrate\data\app.db
MIGRATE_GREEN_EXIT=0
$ node count.cjs
data/app.db → customers = 7            ← 等于备份内取值
backups/imp-20261031-120000-000.db → customers = 7
$ Test-Path data/.restore-pending.json
False                                 ← 标记已被启动期消费
$ Get-ChildItem backups -Filter "pre-restore-*"
pre-restore-20261031-120845-451.db    ← 回退副本落在**注入的**备份目录
```

**隔离复核**：`server/data/app.db` 的 mtime 仍为 `2026/10/13 23:04:22`、sha256
`8826CB3E6D3C08CB1927CD3B637A21D3623DB9FF86DF9374D5A1EF437D1CA723`（验证前后未变）；
临时 `.env` 已删除（`Test-Path .env` = False）。
**还原复核**：红/绿切换用的两份修复版文件还原后 SHA-256 与暂存副本逐字相同
（`restore.ts` `9045EE21…`、`index.ts` `EBE7B0B3…`）。

### 3.4 无回归（AC-6）

```text
$ pnpm --filter server restore-check
结果：24 通过 / 0 失败        RESTORE_CHECK_EXIT=0
```

---

## 四、WP-3：保留策略失败留痕（提交 `91b7149`）

- `services/backup.ts`：`applyRetention(dir, deps: RetentionDeps = {})`，
  `const unlink = deps.unlink ?? unlinkSync` ⇒ **生产行为零变化**；导出供脚本消费。
- 新增 `server/scripts/retention-log-check.ts`（10 项断言）。

### 绿（末次运行，退出码 0）

```text
$ pnpm --filter server retention-check
保留策略失败留痕验证 → E:\…\task051\task051-retention-check-1793420058337
  ✓ 0 临时库已迁移（logs 表存在，否则 writeLog 会失败并掩盖断言）
  ✓ 1 保留份数为 7（场景前提：9 份 ⇒ 超额 2 份）
  ✓ 2 已造 9 个白名单文件名
[backup] 删除旧备份失败（app-20261031-120001-000.db）: Error: EACCES: injected
    at unlink (…\scripts\retention-log-check.ts:145:41)
    at applyRetention (…\src\services\backup.ts:79:7)
  ✓ 3 保留策略共尝试删除 2 个超额文件（9 − 7）
  ✓ 4 返回的 removed 不含注入失败的文件
  ✓ 5 失败文件仍存在（未被误删、不进 removed）
  ✓ 6 其余 1 个超额文件已被真实删除
  ✓ 7 保留份数内的 7 个文件全部未被动过
  ✓ 8 logs 新增 1 行 module=backup 的 error 记录
  ✓ 9 该 error 行 message 含失败文件名与注入的错误文本
  · logs error 行原文：level=error module=backup message=保留策略删除旧备份失败（app-20261031-120001-000.db）：EACCES: injected

结果：10 通过 / 0 失败        RETENTION_EXIT=0
```

三项 AC-9 证据：**注入失败文件名** `app-20261031-120001-000.db`；
**removed 列表** = 另一超额文件（断言 4/6 逐字核对，`removed.length === 1`）；
**logs error 行原文** 见上（`level=error` / `module=backup` / message 含文件名与 `EACCES: injected`）。

### 红（证明断言非空转）

临时把 catch 内的 `void writeLog(...)` 整块移除后重跑：

```text
  ✓ 4/5/6/7 …（前 7 项仍通过）
  ✗ 8 logs 新增 1 行 module=backup 的 error 记录 → {"before":0,"after":0,"newRows":[]}
  ✗ 9 该 error 行 message 含失败文件名与注入的错误文本

结果：8 通过 / 2 失败        RED_EXIT=1
```

还原后 SHA-256 与暂存副本一致（`90228274EE95942434DE3687184ABD445E434B7F17ED473CDAEF584D7B218DD7`），
复跑转绿（见上）。

---

## 五、WP-2：启动级端到端（提交 `065be7f`）

新增 `server/scripts/restore-e2e-check.ts`（21 项断言）。
`server/package.json` 登记 `restore-e2e` / `retention-check`；`knip.config.ts` **未改**
（两个新脚本经 package.json 的 scripts 登记即成为 knip 入口，实测 knip 零告警）。

### 连续两次运行（AC-8，均走 `pnpm --filter server restore-e2e`）

```text
===== RUN 1 =====
  动态端口：52112
  ✓ 0 临时库已迁移（服务进程不自动建表）
  ✓ 1 第一次启动：/api/health 就绪
  ✓ 2 登录取得 token
  ✓ 3 创建备份成功（201 + 文件名合法）
  ✓ 4 记下备份时点的 customers 行数
  ✓ 5 新建一行客户（201）
  ✓ 6 写入已生效（行数 = 备份时点 + 1）
  ✓ 7 排程恢复返回 202
  ✓ 8 恢复标记已写入（且本脚本不删它）
  ✓ 9 第一次启动已回收（进程退出）
  ✓ 10 回收后端口已释放
  ✓ 11 回收后进程确已消失（无孤儿）
  ✓ 12 回收后标记仍在（未被本脚本清理）
  ✓ 13 第二次启动：/api/health 就绪
  ✓ 14 服务层取证：customers 行数回到备份时点值
  ✓ 15 数据层取证：库文件 customers 行数等于备份时点值
  ✓ 16 数据层取证：备份后新增的客户已消失（恢复点之后的数据丢失）
  ✓ 17 数据层取证：标记已被启动期消费（已删除）
  ✓ 18 数据层取证：回退副本 pre-restore-* 已落备份目录
  ✓ 19 审计取证：logs module=restore 出现 applied 记录
  · logs 原文：level=warn module=restore message=已应用备份恢复：app-20261031-122556-754.db（回退副本 pre-restore-20261031-122557-546.db）
  ✓ 20 数据层取证：库文件内 restore 日志含 applied 记录
  端口 52112 已释放，两个子进程均已回收
结果：21 通过 / 0 失败        RUN1_EXIT=0

===== RUN 2 =====
  动态端口：31257
  …（同样 21 项全过）
  · logs 原文：level=warn module=restore message=已应用备份恢复：app-20261031-122600-487.db（回退副本 pre-restore-20261031-122601-284.db）
结果：21 通过 / 0 失败        RUN2_EXIT=0
```

进程与端口清理证明：

```text
$ (Get-Process -Name node).Count
before = 4  →  after = 4                 # 两次运行前后无新增 node 进程
$ netstat -ano | Select-String "LISTENING" | Where-Object { 52112 / 31257 / 13328 / 55091 / 7203 }
（无输出）                                 # 五次运行的端口全部释放
```

**关键设计点**（防「假绿」）：

- `RESTORE_AUTO_EXIT=false` ⇒ 排程后进程不自杀，脚本才能继续断言；
- 第二次启动前**不手工删标记** ⇒ 正是要验证启动期自行消费（断言 17）；
- 数据层取证**直接读库文件**（不只看 HTTP 202）：断言 15/16 证明落库内容确为备份内容；
- 单请求 20s 超时 + 整脚本 240s 看门狗 ⇒ 任何挂起必须失败退出，不允许无限占用。

---

## 六、门禁（AC-10）

| 命令 | 退出码 |
|------|--------|
| `pnpm lint`（eslint .） | 0 |
| `pnpm format:check`（prettier --check .） | 0 |
| `pnpm exec tsc -b` | 0 |
| `pnpm typecheck:server` | 0 |
| `pnpm knip` | 0 |
| `python scripts/audit-repo.py` | 0（**PASS=9 FAIL=0 WARN=0**） |
| `pnpm --filter server restore-check` | 0（24 通过 / 0 失败） |
| `pnpm --filter server retention-check` | 0（10 通过 / 0 失败） |
| `pnpm --filter server restore-e2e` | 0 × 2（21 通过 / 0 失败） |

```text
$ git diff --stat main...HEAD
 server/package.json                                |   4 +-
 server/scripts/restore-apply-check.ts              |   8 +-
 server/scripts/restore-e2e-check.ts                | 421 +++++++++++++++++++++
 server/scripts/retention-log-check.ts              | 208 ++++++
 server/src/db/index.ts                             |  25 +-
 server/src/db/restore.ts                           |  41 +-
 server/src/services/backup.ts                      |  14 +-
 tasks/{review => done}/TASK-050-…                   |  48 +-
 16 files changed, 719 insertions(+), 50 deletions(-)
```

无 `.github/workflows/**`、无 `docker-compose.yml`、无 `schema.ts`、无迁移文件（AC-12）。
前端未改动，未跑前端套件（本任务不改前端；前端回归由 CI 覆盖）。

---

## 七、我未做的事（边界）

未改导入/恢复的 HTTP 契约、状态码、标记文件格式、`pre-restore-*` 白名单策略；
未改 `.github/workflows/**`、`docker-compose.yml`、`Dockerfile`、`schema.ts`、迁移；
未改 `docs/architecture/overview.md` 与 `docs/technical/api-contract.md`（复核后其既有表述仍为真，
且不在 File Scope 内）；未重跑 047/048/049 的回写；**未合并、未打 tag、未自行判定 PASS**；
未在 `server/data/app.db` 上执行任何导入/恢复/建备份（mtime 与 sha256 已验证前后未变）。

---

## Next Action

主控位对本 PR 做第一轮审查：**读实际差异**（四个提交，`bb5d424` → `065be7f`），
重点核对 ① 两处偏差是否可接受（§一）、② WP-1 调用点参数顺序表（§3.2）、
③ WP-2 的进程回收与端口释放是否覆盖 Windows/Linux 差异（§五 + Known Issues 第 2 条）。
整改项以 `HANDOFF-003` 派单；复审通过后转 I2 独立审查；**合并需人类显式授权**。
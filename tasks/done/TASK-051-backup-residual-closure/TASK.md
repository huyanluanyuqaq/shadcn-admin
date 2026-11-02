# TASK-051 — 备份残留收口：D13-C 回写 + 目录注入 + 启动级端到端 + 保留策略失败留痕

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-051
Title: 备份残留收口：D13-C 回写 + 目录注入 + 启动级端到端 + 保留策略失败留痕
Workflow: feature
Status: DONE
Priority: P2
Owner: "Codex / 执行位 Implementer"
Owner Since: "2026-10-31T11:58:00+08:00"
Assigned Role: developer
Created: 2026-10-31T10:20:00+08:00
Updated: 2026-10-31T19:15:00+08:00
Branch: feat/TASK-051-backup-residual-closure
Requires Human Approval: false
```

> **状态与目录的对应关系**（变更 Status 时须同步移动目录）：
>
> | Status | 目录 |
> |--------|------|
> | `BACKLOG`, `READY` | `backlog/` |
> | `ACTIVE`, `DESIGN`, `BLOCKED`, `CHANGES_REQUESTED`, `TEST_FAILED`, `REQUIREMENT_CHANGED` | `active/` |
> | `REVIEW` | `review/` |
> | `DONE` | `done/` |

---

## Objective

把 TASK-050 交付后遗留的三项技术债**收口到可验证状态**，并清偿 D13-C 的第十二笔归档欠账：

1. WP-0：按 D13-C 选项 C 回填 TASK-050 的 `Merge Record` 并归档 `done/`（第十二实例）；
2. WP-1：消除 `BACKUP_DIR` 的第二处「双来源」——恢复的备份目录由调用方**注入**，
   使 `db:migrate` 入口与服务进程解析到**同一目录**；
3. WP-2：补「真实服务启动路径」的启动级端到端验证（TASK-050 `Known Issues` 第 12 条）；
4. WP-3：让保留策略删除失败的分支（AC-9 后半）**可稳定复现并断言**（第 7 条）。

---

## Background

TASK-050（备份导入 + 备份恢复）已合并：PR **#25**、rebase-merge、**16 提交 / 48 文件**、
`merge_commit_sha` `2fdd2c93bbea0ff4ec8bf3a763ede79f24e9d30a`、`merged_at 2026-10-31T01:37:54Z`；
主控位两轮审查（首轮 `CHANGES_REQUESTED` → 整改 → `PASS`）+ I2 独立审查 `PASS`；
已发版 **`v1.0.6`**（annotated tag，指向 `2fdd2c9`）。

任务仍在 `tasks/review/` 且 `Status: REVIEW` —— 这是 D13-C 选项 C 的机制（回写由下一个任务承载），
**本任务就是那个「下一个任务」**，故 WP-0 为第一优先级。

三项技术债的来源（TASK-050 `Known Issues` 原文）：

| # | 问题 | 现状 |
|---|------|------|
| 13 | `db/restore.ts` 的 `resolveBackupDir()` 直读 `process.env.BACKUP_DIR`，与 `services/backup.ts` 的 `config.backupDir` 构成第二处双来源；`db/migrate.ts` 直接 import `db/index.js`、不经 `env.ts` ⇒ 以 `.env` 配 `BACKUP_DIR` 时该入口解析到不同目录，fail-closed（不动文件、标记保留）但**无日志**（该入口不消费 `restoreOutcome`） | 未修 |
| 12 | 「真实服务启动路径」无常驻自动化：`restore-apply-check.ts` 是**单元级**（直接调 `applyPendingRestore`），没有覆盖「进程启动 → `db/index` 读取标记 → 建连接」这条链路 | 未覆盖 |
| 7 | 保留策略删除失败写 `error` 日志的代码路径在位，但**从未实测**（复现需让 `unlinkSync` 失败且 `BACKUP_KEEP` 小于现有份数），档案已如实登记「不得据此认为它已生效」 | 未验证 |

---

## Scope

- **WP-0**：回填 `tasks/review/TASK-050-backup-import-and-restore/TASK.md` 的 `Merge Record` 九要素
  （全部为 `gh api` / Tags API 可复现的**实测值**）；`Status: REVIEW → DONE`；
  `git mv tasks/review/TASK-050-… tasks/done/TASK-050-…`；`Current State` / `Next Action` 改终态
  且**不写死 head 与提交数**；若 `projects/README.md` 存在任务计数快照则同步（不存在则不改并说明）。
- **WP-1**：`applyPendingRestore(dbPath, backupDir)` 改为**由调用方注入备份目录**，
  `db/restore.ts` 内**不再读取 `process.env.BACKUP_DIR`**；`db/index.ts` 从 `config` 推导后传入，
  使 `pnpm db:migrate` 与服务进程口径一致。
- **WP-2**：新增 `server/scripts/restore-e2e-check.ts` —— 启动**真实服务进程**两次，
  走完「登录 → 建备份 → 改数据 → 排程恢复 → 重启 → 数据层取证 → 审计日志取证」。
- **WP-3**：`services/backup.ts` 的 `applyRetention()` 支持注入 `unlink`（默认仍 `unlinkSync`），
  新增 `server/scripts/retention-log-check.ts` 用「抛错的 stub」稳定命中 catch 分支，
  断言 `logs` 出现 `error` 行且其余超额文件仍被删除。
- 三处脚本在 `server/package.json` 登记为 `restore-e2e` / `retention-check`；`knip` 入口按需同步。
- 文档：`docs/operations/backup-restore.md` 补「备份目录口径（注入式）」与两个新脚本的验证方法。

## Non-Scope

- **不改**导入/恢复的 HTTP 契约与语义（路径、状态码、标记文件格式、`pre-restore-*` 白名单策略）。
- **不改** `docker-compose.yml` / `Dockerfile`（TASK-050 已列入 Non-Scope，本任务延续）。
- **不把新脚本纳入 CI**：`ci.yml` 属 `.github/workflows/**`，当前账号 `gh` 缺 `workflow` scope
  （HD-2：推送被拒须停工上报，不得网页绕过）⇒ 纳入 CI 另立任务，本任务只保证**本机可一条命令运行**。
- **不改** `server/src/db/schema.ts` 与迁移（本任务不新增表/列）。
- **不重跑** 047/048/049 的 D13-C 回写（已于 PR #25 清偿）。
- 不改 `tasks/done/TASK-015-system-backup/` 等历史档案。

---

## Requirements

1. **R1（WP-0）**：`Merge Record` 九要素全部填**实测值**，每项给出可复现命令；「审查记录」行指向
   `handoffs/2026-10-31-coordinator-review.md`、`2026-10-31-coordinator-review-round2.md`、
   `2026-10-31-review.md`（I2）。**不得**沿用档案自述，不得猜测。
2. **R2（WP-0）**：`Status` 改 `DONE` 且目录迁到 `tasks/done/`；`Next Action` 改为终态，
   **不写死 head / 提交数**（KI-11：记录自身会推进 head）。
3. **R3（WP-1）**：`db/restore.ts` **零处** `process.env.BACKUP_DIR`；备份目录只能来自入参。
   函数签名建议 `applyPendingRestore(dbPath: string, backupDir: string)`、`resolveBackupFile(dbPath, filename, backupDir)`。
4. **R4（WP-1）**：`db/index.ts` 从 `config.backupDir` 推导（`config.backupDir ? resolve(config.backupDir)
   : join(dirname(dbPath), 'backups')`），并 `import { config } from '../env.js'`。
   **允许**：`env.ts` 无任何项目内 import，不构成环（`db/index.ts` 禁止 import `services/logger.ts` 的禁令**不变**）。
5. **R5（WP-1）**：签名改动后**必须全量 grep 调用点并逐点核对参数顺序**——两个参数同为
   `string`，写反不会报错、只会在运行期静默把回退副本写到错误目录。
6. **R6（WP-2）**：e2e 脚本必须用**真实进程**（`tsx src/index.ts`）且**两次启动**；
   「恢复成功」的判据必须有**数据层证据**（恢复后行数等于备份内取值），不得只看 HTTP 202。
7. **R7（WP-2）**：脚本必须自建临时库与临时备份目录（`AI_DATA_DIR ?? E:/AiData`），
   **禁止**连接或改写 `server/data/app.db`；结束时必须杀掉子进程并释放端口（含 Windows）。
8. **R8（WP-3）**：`applyRetention` 的失败分支须被**确定性**触发（注入抛错 stub），
   断言 ① 返回的 `removed` 不含失败文件、② 其余超额文件确实被删、③ `logs` 出现
   `level='error'` + `module='backup'` 且 `message` 含该文件名。
9. **R9（门禁）**：`eslint` / `prettier` / `tsc -b` / `server typecheck` / `knip` / `audit-repo.py` 全绿；
   `restore-check` 仍为 **24 通过 / 0 失败**（改签名后不得回归）。
10. **R10（档案）**：本任务档案与交接随实现**同批提交**（KI-11），不新开「入库专用」交接。

---

## Constraints

- Node 22 / pnpm 12.10.1；Windows 本机 + Linux CI 双环境都要成立。
- e2e 的端口必须**动态选取**（`listen(0)` 或探测空闲端口），不得写死 3002/3999 之类，
  避免与本机常驻服务冲突。
- `RESTORE_AUTO_EXIT` 在 e2e 中必须为 `false`（否则排程后进程自杀，脚本无法继续断言）；
  第二次启动前**不要**手工删标记 —— 正是要验证启动期自行消费标记。
- 临时目录需保留供人工复查（脚本末尾打印路径），不自动删除（与 `restore-apply-check` 一致）。

## Dependencies

- TASK-050（已合并，`2fdd2c9`）—— 本任务全部改动都在其交付面上。
- 无外部服务依赖；e2e 仅用本机 HTTP 与文件系统。

---

## Acceptance Criteria

- [x] **AC-1（WP-0）** `tasks/done/TASK-050-backup-import-and-restore/TASK.md` 的 `Merge Record` 九要素
      全部为实测值，且逐项可用命令复现：PR `25`、提交数 `16`、`merged_at 2026-10-31T01:37:54Z`、
      `merge_commit_sha 2fdd2c93bbea0ff4ec8bf3a763ede79f24e9d30a`、合并后 CI run `41156271179`（success）、
      合并后 Docker run `41156271209`（success）+ tag 触发的 `41158945149`、镜像 tag 含 `v1.0.6`/`latest`/`sha-2fdd2c9`、
      审查记录三份文件路径。**执行位须自行 `gh api` 复核后填写，不得抄本清单。**
      > **证据**：命令 `gh api repos/:owner/:repo/pulls/25 --jq '{merged,merged_at,sha,commits,title,base}'`
      > → `{"base":"main","commits":16,"merged":true,"merged_at":"2026-10-31T01:37:54Z","number":25,"sha":"2fdd2c93bbea0ff4ec8bf3a763ede79f24e9d30a"}`；
      > `gh api …/pulls/25/commits --jq 'length'` → `16`；
      > `gh api "…/actions/runs?head_sha=2fdd2c93…"` → `41156271179`（CI，push/main，success）、
      > `41156271209`（Docker，push/main，success）、`41158945149`（Docker，push/**v1.0.6**，success，判为 tag 发布 run）；
      > DockerHub Tags API → `sha-2fdd2c9`/`v1.0.6`/`latest` 同 digest `sha256:edd1338b…`；
      > `gh api …/git/tags/c571798f…` → `.object.sha = 2fdd2c93…`（与 merge_commit_sha 逐字相同）。
      > 档案实际填写位置：`tasks/done/TASK-050-…/TASK.md` 的 `## Merge Record` 表（九行）。
- [x] **AC-2（WP-0）** `Status: DONE`，目录已在 `tasks/done/`；`tasks/review/` 下不再有 TASK-050。
      > **证据**：`git ls-files tasks/done/TASK-050-backup-import-and-restore` → 9 个文件（TASK.md + 8 份 handoff）；
      > `git ls-files tasks/review/` → 仅 TASK-051 与本任务 handoff，无 TASK-050；
      > `git grep -n "^Status:" -- tasks/done/TASK-050-backup-import-and-restore/TASK.md` → `Status: DONE`。
- [x] **AC-3（WP-0）** `Next Action` 为终态文案且**不含**写死的 head/提交数（可见文本里无 `4d936e1`/`8ef856e`/`2fdd2c9` 之外的「当前 N 提交」表述）。
      > **证据**：`tasks/done/TASK-050-…/TASK.md` 的 `**Next Action：**` 行为「无（终态）。…」；
      > 全文 `4d936e1`/`8ef856e` 仅出现在审查叙述与 `Merge Record` 的事实陈述中，不在 Next Action；
      > 该行**未**出现任何「当前 N 提交」式表述。
- [x] **AC-4（WP-1）** `grep -n "process.env.BACKUP_DIR" server/src/db/restore.ts` **零命中**；
      `grep -n "config.backupDir" server/src/db/index.ts` 命中。
      > **证据**：`git grep -n "process.env.BACKUP_DIR" -- server/src/db/restore.ts` → **零命中**（退出码 1）；
      > `git grep -n "config.backupDir" -- server/src/db/index.ts` → `:6`（注释）、`:35`（注释）、`:43`、`:44`（代码）共 4 处命中。
- [x] **AC-5（WP-1）** 全量调用点核对留证：`grep -rn "applyPendingRestore\|resolveBackupFile" server/src server/scripts`
      逐条列出行号与传入的**参数名**（不是「看起来对」）。
      > **证据**：`git grep -n "applyPendingRestore\|resolveBackupFile" -- server/src server/scripts` 共 6 处代码命中
      > （另 2 处为注释/import）。逐点实参：
      > `db/index.ts:57` `applyPendingRestore(dbPath, backupDir)` ← `dbPath` = `resolveDbPath()`、`backupDir` = 同文件 `:43` 由 `config.backupDir` 推导；
      > `restore.ts:121` `resolveBackupFile(marker.filename, backupDir)` ← 透传上层入参；
      > `restore-apply-check.ts:183/207/285/322` `applyPendingRestore(DB_PATH, BACKUP_DIR)` ← 两个均为脚本既有常量（临时库 / 临时备份目录）。
      > 顺序正确性另由 WP-1 红/绿兜底（若写反，恢复会因「备份文件不存在」失败）。
- [x] **AC-6（WP-1）** `pnpm --filter server restore-check` 仍 **24 通过 / 0 失败**、退出码 0。
      > **证据**：命令与完整输出见 `HANDOFF-004` §五-1。期望 24/0，**实际 24 通过 / 0 失败，退出码 0**。
- [x] **AC-7（WP-2）** `pnpm --filter server restore-e2e` 退出码 0；输出含**两次启动**的日志片段、
      恢复后 `customers` 行数等于备份内取值、`GET /api/logs?module=restore` 命中 `applied` 记录。
      > **证据**：命令与完整输出见 `HANDOFF-004` §五-3。期望 21/0 × 2 + 三样取证，
      > **实际 21 通过 / 0 失败、退出码 0**（两次，端口 60626 / 39150，见 HANDOFF-004 §五-3）；
      > 输出含 `· 启动日志[1] …` 与 `· 启动日志[2] [restore] 已应用备份 app-…db，原库留作 pre-restore-…db`
      > 两组片段；断言 14/15（服务层与数据层行数回到备份时点值）、19/20（`logs` 命中 `已应用备份恢复`）。
      > **M-3 处置**：选**方案 A（改实现）**——`waitForHealth` 成功后打印子进程最近 3 行 stdout/stderr，
      > 理由见 `HANDOFF-004` §二-M-3。AC 措辞保持原样（未改）。
- [x] **AC-8（WP-2）** 连续跑两次 e2e 均成功（证明端口动态、临时目录不冲突、进程被回收）；
      运行后 `netstat`/`lsof` 无遗留监听，`tasklist`/`ps` 无遗留 `tsx` 子进程。
      > **证据**：两次运行端口分别为 **60626** 与 **39150**（不同 ⇒ 端口确为动态选取）；
      > `netstat -ano | Select-String "LISTENING"` 对两个端口均无命中；`Get-Process node`
      > 计数运行前后不变；脚本断言 9/10/11（进程退出、端口释放、进程消失）两次全绿，
      > 且两次末行均打印「端口 … 已释放，两个子进程均已回收」。
- [x] **AC-9（WP-3）** `pnpm --filter server retention-check` 退出码 0；输出含
      「注入失败文件名」「removed 列表」「logs 中新出现的 error 行原文」三项证据。
      > **证据**：命令与完整输出见 `HANDOFF-004` §五-2。三项齐备：
      > 注入失败文件名 `app-20261031-120001-000.db`；`removed` 长度 1 且逐字断言（不含失败文件）；
      > `logs` error 行原文 `level=error module=backup message=保留策略删除旧备份失败（app-20261031-120001-000.db）：EACCES: injected`。
      > 实际 **10 通过 / 0 失败，退出码 0**（R-5 把恒真断言换成真断言后条数不变）。
- [x] **AC-10（门禁）** eslint / prettier / `tsc -b` / `pnpm --filter server typecheck` / `pnpm knip` /
      `python scripts/audit-repo.py`（`PASS=9 FAIL=0`）全绿；`git status --short` 仅 File Scope 内文件。
      > **证据**：六项退出码与 `audit-repo.py` 的 `PASS=9 FAIL=0 WARN=0` 见 `HANDOFF-004` §五-4；
      > `git status --short` 仅 `server/scripts/restore-e2e-check.ts`、`server/scripts/retention-log-check.ts`、
      > `server/src/services/backup.ts`、`docs/operations/backup-restore.md` 与 `tasks/review/TASK-051-…/**`
      > —— 全部在 File Scope 内。
- [x] **AC-11（文档）** `docs/operations/backup-restore.md` 有「备份目录由调用方注入」的说明，
      并给出 `restore-e2e` / `retention-check` 两条命令与各自的判据；无失效的否定性断言残留。
      > **证据**：§1 表格「目录口径」行 = 「单一推导点 + 调用方注入…」；§3.1 第 4 步写明
      > `applyPendingRestore(dbPath, backupDir)` 及 `backupDir` 由 `db/index.ts` 从 `config.backupDir` 推导后注入；
      > §4.1 / §4.2 分别给出两条命令与判据（21 通过 / 10 通过）。M-2 已把两处失真的
      > 「自 TASK-015 起就在位」改为 TASK-050 `df06dbe` 引入的实测表述；
      > 判据 `git grep -rn "自 TASK-015 起"` 排除 `tasks/` 后**零命中**。
- [x] **AC-12（WP-0 边界）** 未改动 047/048/049 的既有回写；未改 `.github/workflows/**`；
      `git diff --stat main...HEAD` 无 `docker-compose.yml` / `schema.ts` / 迁移文件。
      > **证据**：对 `git diff --name-only main...HEAD` 的**全量清单**逐项核对（**不写死文件数** ——
      > 该数字每轮都会因档案提交而变化，I2 记录项 5-1 已指出「20 个文件」在 head 上已过期），
      > 047/048/049 三个档案**零变动**；
      > 无 `.github/workflows/**`、`docker-compose.yml`、`Dockerfile`、`server/src/db/schema.ts`、
      > `server/drizzle/**` 任何一行（完整清单见 `HANDOFF-004` §五-6）。

---

## File Scope

| 文件 | 预期变更 |
|------|---------|
| `tasks/review/TASK-050-backup-import-and-restore/TASK.md` → `tasks/done/…` | WP-0 回填 + `Status=DONE` + `git mv` |
| `server/src/db/restore.ts` | WP-1：去掉 `process.env` 读取，备份目录改为入参 |
| `server/src/db/index.ts` | WP-1：从 `config` 推导 `backupDir` 并传入 |
| `server/scripts/restore-apply-check.ts` | WP-1：调用点补第二参数（显式传临时备份目录） |
| `server/scripts/restore-e2e-check.ts` | WP-2：**新增**启动级端到端脚本 |
| `server/src/services/backup.ts` | WP-3：`applyRetention` 支持注入 `unlink` 并导出 |
| `server/scripts/retention-log-check.ts` | WP-3：**新增**保留策略失败留痕脚本 |
| `server/package.json` | 登记 `restore-e2e` / `retention-check` 脚本 |
| `knip.config.ts` | 如需把新脚本登记为入口（否则 knip 会判为未使用文件） |
| `docs/operations/backup-restore.md` | 注入式口径 + 两个新脚本的用法与判据 |
| `tasks/backlog/TASK-051-backup-residual-closure/**` | 本任务档案与交接 |

## Implementation Plan

### Phase 0 — 基线复核与领取
- `git rev-parse --short main` 应为 `2fdd2c9`；`git status --short` 为空。
- 复跑基线：`pnpm --filter server restore-check`（期望 24/0）。
- `git switch -c feat/TASK-051-backup-residual-closure`，档案 `backlog/ → active/`、`Status: ACTIVE`。

### Phase 1 — WP-0：D13-C 回写（**先做，独立提交**）
- 逐项用 `gh api` 实测九要素；填表；
- `Status: REVIEW → DONE`；`git mv` 到 `done/`；`Current State` / `Next Action` 改终态；
- 单独提交：`docs(TASK-050): 按 D13-C 回填 Merge Record 并归档至 done/`。

### Phase 2 — WP-1：目录注入
- 改 `restore.ts` 签名与内部推导；改 `db/index.ts`（import `env.js`，**不得** import `logger.ts`）；
- 改 `restore-apply-check.ts` 调用点；
- 逐点核对调用点顺序（R5），把 grep 输出贴进交接。

### Phase 3 — WP-3：保留策略失败留痕（比 WP-2 小，先做以便验证手法）
- `applyRetention(dir, deps?)` 注入 `unlink`；导出；
- 写 `retention-log-check.ts`：临时库跑迁移 → 9 个白名单文件名 → 注入第 1 个抛错 →
  断言 removed / 文件仍在 / logs 有 error。

### Phase 4 — WP-2：启动级 e2e
- 动态端口 + 两次 spawn + 登录 + 建备份 + 改数据 + 排程恢复 + 重启 + 数据层与审计取证；
- 进程与端口清理；连续两次运行均成功（AC-8）。

### Phase 5 — 收尾
- 全量门禁 + 文档 + 回填 `Changed Files` / `Known Issues` + `HANDOFF-002`；
- 推送、开 PR、停下等审查。

---

## Verification Plan

| 项 | 命令 | 期望 |
|----|------|------|
| 单元级恢复 | `pnpm --filter server restore-check` | 24 通过 / 0 失败 |
| 启动级 e2e | `pnpm --filter server restore-e2e` | 退出码 0，含两次启动与数据层证据 |
| 保留策略留痕 | `pnpm --filter server retention-check` | 退出码 0，含 logs error 行原文 |
| 前端（防回归） | `pnpm exec vitest run --browser.headless` | 26 文件 / 335 用例（本任务不应改动前端） |
| 静态门禁 | `pnpm lint` / `pnpm format:check` / `pnpm exec tsc -b` / `pnpm typecheck:server` / `pnpm knip` | 全绿 |
| 框架审计 | `python scripts/audit-repo.py` | `PASS=9 FAIL=0`（WP-0 迁移后编号仍唯一） |

---

## Current State

> 2026-10-31：主控位起草。基线 `main 2fdd2c9`（TASK-050 已合并并已发 `v1.0.6`）。
> `Status: READY`，待执行位领取。三项债的技术细节见 `Background` 表。

> 2026-10-31：执行位领取。分支 `feat/TASK-051-backup-residual-closure`（自 `main 2fdd2c9` 派生），
> `Status: ACTIVE`。基线复核已过：`git status --short` 仅本任务目录（untracked），
> `pnpm --filter server restore-check` = **24 通过 / 0 失败**（`AI_DATA_DIR` 指向沙箱可写目录，
> 见 Known Issues）。按 Phase 0→5 实施，WP-0 独立提交且最先做。

> 2026-10-31：执行位交付，`Status: REVIEW`，待主控位两轮审查 + I2 独立审查。
> 四个提交（WP-0 独立最先，其后 WP-1 / WP-3 / WP-2），`git diff --stat main...HEAD`
> 不含 `.github/workflows/**`、`docker-compose.yml`、`schema.ts` 与迁移文件。
> 门禁全绿：eslint / prettier / `tsc -b` / `typecheck:server` / knip / `audit-repo.py`（PASS=9 FAIL=0）；
> `restore-check` 24/0（签名改动后无回归）、`retention-check` 10/0、
> `restore-e2e` 连续两次 21/0。红/绿实测各一组（WP-1 的 `db:migrate` 入口、
> WP-3 的 catch 分支），原始输出见 `handoffs/HANDOFF-002-implementer-to-coordinator.md`。

> 2026-10-31：主控位第 1 轮审查 → **CHANGES_REQUESTED**（**0 阻断** + 3 必须修 + 6 记录项）。
> 记录 `handoffs/2026-10-31-coordinator-review.md`，整改派单 `handoffs/HANDOFF-003-coordinator-to-implementer.md`。
> 技术交付被判**可合并级**：三个脚本主控位均独立复跑通过（24/0、10/0、21/0 ×2，端口 57860/34580），
> `process.env.BACKUP_DIR` 在 `db/restore.ts` 零命中，6 处调用点实参顺序逐点核对无误，
> 并另行确认 `env.ts:36` 顶层 `loadDotEnv()` ⇒ WP-1 的修复**实质有效**（非把双来源挪位）。
> 拦下的三项全在档案层：**M-1** 12 条 AC 一条未勾却已宣告交付；**M-2**
> 「保留策略失败写日志的分支自 TASK-015 起就在位」为可复现的事实错误（实测由 TASK-050 的
> `df06dbe` 引入）；**M-3** AC-7「输出含两次启动的日志片段」在成功路径下不成立（`log` 仅在
> health 失败时作 detail 打印）。记录项 R-1~R-6 见审查记录 §三。
>
> 2026-10-31：执行位完成第 1 轮整改（M-1~M-3 + R-1~R-6 全闭环），新增 4 个提交
> （`3583816` / `d695184` / `e6c69b9` / `546cd22`），PR #26 已更新，**待主控位复审**。
> 12 条 AC 已全部勾选并附证据引注；M-3 选**方案 A（改实现）**，`restore-e2e` 现在会打印
> 两次启动的子进程日志片段（第二次那几行直接显示 `[restore] 已应用备份 …`）。
> 三个验证脚本在整改后重跑：`restore-check` 24/0、`retention-check` 10/0、
> `restore-e2e` 21/0 ×2（端口 60626 / 39150）；门禁全绿（含 `audit-repo.py` PASS=9 FAIL=0）。
> 逐条证据见 `handoffs/HANDOFF-004-implementer-to-coordinator.md`。


> 2026-10-31：主控位第 2 轮审查（复审，head `a17a6ab`）→ **整改 PASS**（0 必须修 / 0 阻断）。
> 记录 `handoffs/2026-10-31-coordinator-review-round2.md`。M-1~M-3 与 R-1~R-6 全闭环，
> 且三处关键声明由主控位**自建探针**复现：R-5 变异注入 → 9 通过/1 失败（仅断言 0 变红，还原后
> sha256 `c2bfd5ec…5B0` 与交接逐字一致）；M-2 溯源 → `56b2200` 时点实测 `20 files / +1670 / −52`，
> 且 `91b7149` 提交信息里的旧表述属实（禁 force-push，未改历史）；M-3 → 实跑日志含
> `启动日志[1]`/`启动日志[2]`，第二次直接打印 `[restore] 已应用备份 …`。
> 主控位独立复跑：`restore-check` 24/0、`retention-check` 10/0、`restore-e2e` 21/0 ×2（端口 9175/33365）、
> eslint / `tsc -b` / `typecheck:server` / knip 均 0、`audit-repo.py` PASS=9 FAIL=0 WARN=0。
> **合并被外部 CI 故障阻断（E-1，非本 PR 引入）**：`ci.yml` 的 `runs-on: ubuntu-latest` 已滚到
> `ubuntu-26.04`，仓库钉的 `playwright@1.59.1` 不支持该系统 ⇒ `install-lint-build` 在 run
> `41169151883` / `41178010478` 上均失败（`audit` 仍 pass）；main 上一次 CI（`41156271179`，01:37）
> 为 success，故属环境侧在 01:37~04:34 之间变化。修复需改 `.github/workflows/**`（钉 `ubuntu-24.04`）
> 或升 `playwright`，两者都撞 HD-2（无 `workflow` scope，禁网页绕过）⇒ **由人类决定，执行位未动**。
> 记录项 R-7（`HANDOFF-004` §七 写「8 提交」实测 10，KI-11 型滞后）、R-8（`Current State` 时序倒置）
> 不阻断，随下一动作处理。

> 2026-10-31：**I2 独立审查完成 → PASS**（0 阻断 / 0 必须修 / 3 记录项），
> 记录 `handoffs/2026-10-31-review.md`（29 KB）。主控位核验该记录自身（审查记录亦在被审范围）：
> 抽查的可复现字面量全部一致 —— `sha256(retention-log-check.ts)` = `c2bfd5ec…5b0`、
> `git diff --shortstat 2fdd2c9 HEAD` = `21 files / +2207 / −53`、`gh auth status` 两账号与 §5-3 自述一致、
> `server/data/app.db` 的 mtime 仍 `2026-10-13 23:04:22`（真实库未被碰）。该记录**不自述工作区干净**，
> 而是主动披露「四份审查档案未跟踪」，KI-11 处置正确；并补验了主控位明示未验的 DockerHub digest。
> **E-1 独立裁定：环境侧**（I2 与我各自独立得出同一结论）—— main 的 run `41156271179`（01:38）日志为
> `Image: ubuntu-24.04`，PR 的 run `41178010478`（06:47）为 `Image: ubuntu-26.04`，两者之间代码与依赖版本未变。
> **E-1 决定（主控位）：走路径 B —— 升 `playwright` 1.59.1 → 1.64.1。** 派单 `handoffs/HANDOFF-005`。
> 三个依据：① 路径 A 在当前身份下**不可执行** —— 活动账号无 `workflow` scope，唯一有 scope 的 `ndldsn`
> 对该仓库实测 `push: false`（仅 `pull: true`），它连分支都推不了；② 路径 B 只改根 `package.json` +
> lockfile，不撞 HD-2；③ B 的成本比预估低 —— `@vitest/browser-playwright@4.1.4` 的 peer 对 playwright 是 `*`，
> 故**无需**升 vitest 插件链。版本支持已解包核对：1.59.1 只到 `ubuntu24.04`，1.64.1 含 `ubuntu26.04`。
> 零成本路径亦已试过并失败：`gh run rerun 41178010478 --failed` → attempt 2 仍 fail，镜像仍 26.04。
> 对 I2 三记录项的处置：5-1 采纳（AC-12 引注不再写死数字）、5-2 采纳并加强（见上，A 是「不可执行」而非
> 「需授权」）、5-3 记录属实但不构成可行路径（scope 与仓库写权限是两件事，禁止切换账号推送）。
>
> 2026-10-31：**E-1 已修复（路径 B）且 CI 转绿。** 执行位按 `HANDOFF-005` 只把根
> `package.json` 的 `devDependencies.playwright` 从 `1.59.1` 升到 `1.64.1` 并提交
> `pnpm install` 生成的 lockfile（**未改** `.github/workflows/**`、`server/**`、`src/**`、
> 任何测试断言；**未升** vitest / `@vitest/browser-playwright`，其 peer 对 playwright 为 `*`）。
> 前端全量与基线**逐文件零差异**（均 26 文件 / 335 用例 / 0 失败，`Compare-Object` 的 26 行
> 「文件名+用例数+状态」三元组无差异；两次运行均未出现 `shared/dist` 重复收集）；
> chromium 已随 1.64.1 重装（headless-shell v1248）。五项门禁退出码全 0
> （`audit-repo.py` PASS=9 FAIL=0 WARN=0）；`restore-check` 24/0、`retention-check` 10/0、
> `restore-e2e` 21/0；`server/data/app.db` mtime 仍 `2026-10-13 23:04:22`（长度 266240）。
> **`install-lint-build` 已转绿**（run `41192636024`，head `dbbf284`，两作业均 success）。
> 四份未跟踪审查档案已随 `dbbf284` 入库（KI-11：不宣称「工作区干净」）。
> 逐项留证见 `handoffs/HANDOFF-006-implementer-to-coordinator.md`。

> 2026-10-31：主控位第 3 轮审查（E-1 修复复审，head `e1be4be`）→ **技术交付 PASS**，
> **1 必须修（M-1，档案层）** + 2 记录项。记录 `handoffs/2026-10-31-coordinator-review-round3.md`。
> 独立复跑（未采信交接自述）：`pnpm test` **26 文件 / 335 passed**（与交接、CI 三方一致）、
> eslint / prettier / `tsc -b` / knip 均 0、`audit-repo.py` PASS=9 FAIL=0 WARN=0、
> `restore-check` 24/0、`retention-check` 10/0；`git diff --name-only a17a6ab..HEAD` 仅 10 个文件
> （2 依赖 + 8 档案）⇒ **零越界**；`server/data/app.db` mtime 仍 `2026-10-13 23:04:22`；工作区干净。
> **E-1 修复有效性判据 = 同一坏镜像上转绿**（不是「CI 绿了」）：失败 run `41178010478` 与绿 run
> `41193005395` 的 `Image:` 行**均为 `ubuntu-26.04`**，仅 playwright 由 1.59.1 → 1.64.1
> （`chromium v1248` 安装成功），测试从「未执行」变为 `Test Files 26 passed / Tests 335 passed`
> ⇒ 环境未变、只换工具链版本、结果由红转绿，**修复成立，非碰运气**。
> **M-1（必须修）**：`TASK.md:436/438` 的「最新 Handoff」仍指 `HANDOFF-005`，
> `Next Action` 仍写「执行位按 `HANDOFF-005` 升 playwright」——该动作已由 `4867a34` 完成，
> 违反 `AGENTS.md` §13 的 DoD 检查项「Next Action 指向未完成动作」。**由执行位以单个 docs 提交修正**
> （主控位不推任务分支），不新开 HANDOFF 文件（KI-11）。
> 记录项：4-1 `HANDOFF-006` 引用的 run `41192636024` 属 `dbbf284`（写交接时末提交未推，KI-11 型），
> 合并时点 head 为 `e1be4be` / run `41193005395`；4-2 基线未另开 worktree 的简化经独立验证**可接受**
> （`a17a6ab..HEAD` 在 `src/ shared/ server/` 与三处 config 上全空）。
> 另记：本地复跑首次 `no tests` 的根因是**本机 safe-delete 护栏**拦截 vite 批量清理
> `node_modules/.vite`（119 > 阈值 50），非代码问题；处置 `mv node_modules/.vite /tmp/…` 后 335 通过。
> 该坑写入审查记录 §1.1，供后续复跑者避坑。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/review/TASK-050-backup-import-and-restore/**` → `tasks/done/**` | 移动 + 修改 | WP-0：`git mv` 归档 + `Merge Record` 九要素实测回填 + `Status: DONE` |
| `server/src/db/restore.ts` | 修改 | WP-1：`applyPendingRestore(dbPath, backupDir)`；删除 `resolveBackupDir()`，零处读取环境变量 `BACKUP_DIR` |
| `server/src/db/index.ts` | 修改 | WP-1：`import { config } from '../env.js'`；`backupDir` 单一推导后注入 |
| `server/scripts/restore-apply-check.ts` | 修改 | WP-1：4 个调用点补第二实参（显式传临时备份目录） |
| `server/scripts/retention-log-check.ts` | 新增 | WP-3：保留策略失败留痕验证脚本（10 项断言） |
| `server/scripts/restore-e2e-check.ts` | 新增 | WP-2：启动级端到端脚本（21 项断言，两次真实启动） |
| `server/src/services/backup.ts` | 修改 | WP-3：`applyRetention(dir, deps?)` 支持注入 `unlink`（默认仍 `unlinkSync`）并导出 |
| `server/package.json` | 修改 | 登记 `restore-e2e` / `retention-check` 两个脚本 |
| `docs/operations/backup-restore.md` | 修改 | §1 目录口径行、§3.1 注入式说明、§4.1/§4.2 两个新脚本的用法与判据、§6 两条排查项 |
| `tasks/active/TASK-051-backup-residual-closure/**` | 新增/移动 | 本任务档案与交接（`active/` → `review/`） |

**未改**（File Scope 之外，且经复核其既有表述仍为真）：`docs/architecture/overview.md`
（§12.8 未描述目录推导方式）、`docs/technical/api-contract.md`、`knip.config.ts`
（两个新脚本经 `server/package.json` 的 scripts 登记为 knip 入口即可，无需新增 ignore）。

---

## Known Issues

1. **WP-2 的 e2e 未纳入 CI（本任务刻意）**：纳入须改 `.github/workflows/**`，而当前账号 `gh`
   缺 `workflow` scope（HD-2 裁决：推送被拒须停工上报，禁网页绕过）。本任务**未尝试推送
   workflow 改动**，`restore-e2e` / `retention-check` 目前只能在本机手动执行。
   本任务的验证全部在本机完成（连续两次 `restore-e2e` + 一次 `retention-check`）。
   **CI 是 Linux**：脚本的进程回收用 `child.kill('SIGTERM')` → 宽限 → `process.kill(pid,'SIGKILL')`，
   跨平台等价，但**未在 Linux 上实测过**（本机只有 Windows）。若将来纳入 CI，首次运行须复核。
2. **本沙箱内 `taskkill` 不可用**：实测 `taskkill /pid <pid> /T /F` 返回 `Access denied`
   （子进程由 Node 直接派生、同用户仍被拒），而 `child.kill()` / `process.kill()` 可用。
   故 WP-2 的回收一律走 Node 的信号通道，**没有**用 `taskkill` 杀进程树。
   `node --import tsx src/index.ts` 的 loader 在进程内注册（无孙子进程），杀单个 PID 即够；
   脚本仍以「端口可再监听 + 进程确已消失」两条断言兜底（实测运行前后 node 进程数不变）。
3. **`pnpm` 是否需要 `--config.verify-deps-before-run=false` 取决于环境**：执行位所在沙箱内
   workspace 级 pnpm 命令会触发 deps-status 检查并在非 TTY 下中止，需加该参数；
   而主控位本机**不加也能直接跑通**（`retention-check` / `restore-e2e` 均成功）。
   子进程里无法稳定传该参数，故 WP-2 用 `node --import tsx src/index.ts` 直接起服务
   （同一解释器、同一份源码）。本文档 §4.1/§4.2 因此刻意**不写**该参数——
   写死会让可正常运行的机器以为必须额外配置。
4. **`E:/AiData` 的可写性取决于环境**：三个脚本默认目录为 `AI_DATA_DIR ?? E:/AiData`
   （与 `restore-apply-check.ts` 一致，Task Rules 要求）。主控位本机**可直接写入**
   （产物落在 `E:\AiData\task051-*`，`touch` 探针通过）；执行位所在沙箱内则**不可写**
   （实测 `EPERM: operation not permitted, mkdir 'E:\AiData\…'`），此时设
   `AI_DATA_DIR` 指向可写目录即可（脚本本来就优先读该变量），无需改代码。
5. **WP-1 的副作用（超出原表述，如实登记）**：`db/index.ts` import `env.js` 后，
   `pnpm db:migrate` 入口**也开始**从 `.env` 读取 `DATABASE_URL`（此前它只读 OS env，
   没有 `.env` 时回落 `server/data/app.db`）。这正是「两个入口口径一致」的目标，
   但意味着「只在仓库根 `.env` 里配 `DATABASE_URL`」的本地用法下，`db:migrate` 的目标库
   会从 `server/data/app.db` 变为 `.env` 指定的库。容器内不受影响
   （`docker-compose.yml` 以 OS env 传 `DATABASE_URL`，优先级高于 `.env`）。
   已在本机以「`BACKUP_DIR` 仅在 `.env` + `DATABASE_URL` 走 OS env」隔离复现红/绿，
   `server/data/app.db` 的 mtime 与 sha256 验证前后未变。
6. **WP-3 的「第 1 个被删文件」不是最旧的那个**：`listFiles()` 按 mtime **降序**排后
   `slice(keep)`，故 9 份 keep=7 时先删的是**第二旧**、再删最旧。脚本用「第 1 次 unlink
   调用即注入失败」的计数器 stub 命中，不依赖对排序的手工推断。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | coordinator | implementer | 2026-10-31 | 派单：WP-0 回写（第十二实例）+ WP-1 目录注入 + WP-2 启动级 e2e + WP-3 保留策略失败留痕 |
| 002 | implementer | coordinator | 2026-10-31 | 交付：四提交（WP-0/WP-1/WP-3/WP-2），门禁全绿 + 红/绿实测两组；两处与派单的偏差已上报（`resolveBackupFile` 去 `dbPath` 形参、子进程用 `node --import tsx` 取代 pnpm） |
| 003 | coordinator | implementer | 2026-10-31 | 整改：M-1 AC 全量勾选 + 证据指针、M-2 更正「自 TASK-015 起」事实错误（2 处）、M-3 AC-7 与实现择一处理；R-1~R-6 六项记录项同批 |
| 004 | implementer | coordinator | 2026-10-31 | 整改闭环：M-1 12 条 AC 全勾 + 证据引注；M-2 附三条溯源命令；M-3 选方案 A（补启动日志输出）；R-1~R-6 全清（R-5 附变异探针）；门禁全绿 + 三脚本重跑 |
| — | I2 reviewer | coordinator | 2026-10-31 | 独立审查 **PASS**（0 阻断 / 0 必须修 / 3 记录项），`handoffs/2026-10-31-review.md`；独立裁定 E-1 为环境侧；补验 DockerHub digest；6 项未做事项如实降权 |
| 005 | coordinator | implementer | 2026-10-31 | E-1 修复派单：升 `playwright` 1.59.1 → 1.64.1（路径 B，不撞 HD-2）；含对 I2 三记录项的处置与前端基线对照要求 |
| 006 | implementer | coordinator | 2026-10-31 | E-1 修复交付：两提交（deps + 档案入库），前端全量与基线逐文件零差异，五项门禁全 0，三脚本重跑通过，`install-lint-build` 转绿（run `41192636024`） |
| — | coordinator | — | 2026-10-31 | 第 3 轮审查（E-1 修复复审）：**技术 PASS** + 1 必须修（M-1：`Next Action` 仍停在派单阶段）+ 2 记录项，`handoffs/2026-10-31-coordinator-review-round3.md` |

**最新 Handoff：** `handoffs/HANDOFF-006-implementer-to-coordinator.md`（E-1 修复交付；
最新审查：`handoffs/2026-10-31-review.md` = I2 独立审查 **PASS**、
`handoffs/2026-10-31-coordinator-review-round3.md` = 主控位第 3 轮复审 **PASS** + M-1）
**Next Action：** 只剩三步，均**未完成**（M-1 档案收口已由本次 docs 提交处理，不在此列）：

1. **人类显式授权**（不可由 Agent 代替）；
2. `gh pr merge 26 --rebase --delete-branch`，合并后本地 ff 并核对 `main` head；
3. 合并后本任务按 D13-C 选项 C 保持 `Status: REVIEW`、留在 `tasks/review/`，
   由**下一个任务**以**第十三实例**回填 `Merge Record`（head 与提交数以合并时点为准，不写死）。

> 已竣工故不再列为动作：E-1 依赖升级（`4867a34`）、四份审查档案入库（`dbbf284`）、
> E-1 交接（`e1be4be`）、CI 双绿（head `e1be4be` → run `41193005395`）、
> 主控位第 3 轮复审 PASS。E-1 的路径 A（钉 `runs-on: ubuntu-24.04`）已裁定为
> **当前身份下不可执行**（`ndldsn` 对该仓库 `push: false`），故不作为本任务动作；
> 若人类日后愿意调整权限，可另立任务补做「钉 runner 防漂移」。

执行位已停下：未合并、未打 tag、未自行判定 PASS。

---

## Merge Record

> 本节由 **TASK-055**（执行位）按 D13-C 选项 C 于 2026-11-02 实测回填。
> 原「本节不随 Pass/收尾填写」的机制说明已履行完毕（本任务已由下一个任务回收归档），
> 故替换为实测值。九要素全部来自下方「复现命令」的**实际输出**，未沿用档案自述。

| 要素 | 值 |
|------|-----|
| PR | [#26](https://github.com/huyanluanyuqaq/shadcn-admin/pull/26) `feat(TASK-051): 备份残留收口…` |
| 合并策略 | `rebase-merge`（实测：merge commit 只有 **1 个 parent** `7169b72`，非双亲合并提交） |
| 提交数 | **14** |
| merged_at | `2026-10-31T12:04:52Z` |
| merge_commit_sha | `e563800334ab676644d1f5c1f1bf1fb58962dd38` |
| 合并后 CI run | `41199514208`（Continuous Integration，`event=push` `head_branch=main`，conclusion=**success**） |
| 合并后 Docker run | `41199514198`（Build and Push Docker Image，`event=push` `head_branch=main`，conclusion=**success**） |
| 镜像 tag | `sha-e563800`（digest `sha256:b6da326e15e41c9e24735ab8986c5198b0faa3ce4e1bce907ff5da09a0795575`，`tag_last_pushed=2026/10/31 12:44:38`） |
| 审查记录 | `handoffs/2026-10-31-review.md`（I2 独立审查，不携带实现上下文）+ 三份主控位记录 `2026-10-31-coordinator-review.md` / `-round2.md` / `-round3.md` |

**「镜像 tag」格必须区分合并 run 与 tag 发布 run**：本任务另有 run `41202023831`
（`Build and Push Docker Image`，`event=push`，`head_branch=v1.0.7`，conclusion=success，
`created_at=2026-10-31T12:38:40Z`）——它挂在 **`v1.0.7` 这个版本 tag** 上，属**发布 run，不是合并 run**，
因此**不计入**上表「合并后 Docker run」。合并 run 是 `41199514198`（`created_at=2026-10-31T12:04:55Z`，
与 CI run 同一时刻、同一 `head_sha`）。

**合并未推进 `latest`**：`latest` 至今仍为 `sha256:b6da326e15e41c9e…`，与 `v1.0.7` / `sha-e563800`
**三者同 digest**；也就是说 `main` 上此后的合并（含 TASK-052/053/054 的 `sha-2ca5d50`，
digest `sha256:0658ac254eeb76a5…`）**都没有**把 `latest` 推过去。`latest` 只在打版本 tag 时前进
（`.github/workflows/docker.yml` 仅由 `v*` 触发，见 `AGENTS.md` §14.3）。

**复现命令**（每条均在 2026-11-02 于本仓实跑，输出即上表数值）：

```bash
# PR 基本信息 + 提交数
gh api repos/huyanluanyuqaq/shadcn-admin/pulls/26 \
  --jq '{merged:.merged, merged_at:.merged_at, merge_commit_sha:.merge_commit_sha, commits:.commits}'
gh api repos/huyanluanyuqaq/shadcn-admin/pulls/26/commits --jq 'length'      # → 14

# 该 merge_commit_sha 上的全部 run（据此区分合并 run 与 tag 发布 run）
gh api "repos/huyanluanyuqaq/shadcn-admin/actions/runs?head_sha=e563800334ab676644d1f5c1f1bf1fb58962dd38&per_page=20" \
  --jq '.workflow_runs[] | {id:.id, name:.name, event:.event, head_branch:.head_branch, conclusion:.conclusion, created_at:.created_at}'

# 合并策略：单 parent ⇒ rebase-merge
git log --format="%H %P %s" -1 e563800334ab676644d1f5c1f1bf1fb58962dd38

# 镜像 tag（DockerHub Tags API，匿名可读）
Invoke-RestMethod https://hub.docker.com/v2/repositories/nomorelatenights/subscription-admin/tags/sha-e563800
Invoke-RestMethod https://hub.docker.com/v2/repositories/nomorelatenights/subscription-admin/tags/latest
```

> **本任务的欠账说明**：本任务随 PR #26 于 2026-10-31 合并，按 D13-C 本应由 TASK-052 补记本表，
> 但 052/053/054 三轮均未回填，欠账已滚过三轮。现由 TASK-055 一并清偿
> （`github-collaboration.md` §224「至多延后一个任务」的终止条件已被突破，此处如实登记）。

---

## Task Rules

- [补充] **WP-0 只允许填实测值**；任何一项 `gh api` 拿不到就留「待回填」并上报，不得猜测（沿用 TASK-050 Phase 5 规则）。
- [补充] 验证只允许用临时库与临时目录（`AI_DATA_DIR ?? E:/AiData`），**禁止**在 `server/data/app.db`
  上执行导入/恢复/建备份；e2e 的 `DATABASE_URL` 必须指向临时库。
- [补充] e2e 必须动态选端口、必须回收子进程；脚本结尾打印临时目录供人工复查，**不自动删**。
- [补充] 签名改动（WP-1）后**必须全量 grep 调用点并逐点核对参数名**：两参同为 `string`，
  顺序写反不报错、运行期静默写错目录（TASK-046 教训）。
- [补充] `db/index.ts` 可以 import `env.js`（无环），但**仍然禁止** import `services/logger.ts`。
- [补充] WP-3 的注入参数默认值必须保持 `unlinkSync`，生产行为零变化；只允许测试侧替换。
- [补充] 任务档案与交接随实现**同批提交**（KI-11），不新开「入库专用」交接。
- [补充] CI knip 要求零新增未使用导出：`applyRetention` 导出后必须有真实消费者（脚本），
  并把新脚本登记为 knip 入口，否则红灯。

---

## Notes

- 本任务是 TASK-050 `Known Issues` 第 7 / 12 / 13 条的收口，不含新功能。
- `v1.0.6` 已于 2026-10-31 发布（tag 指向 `2fdd2c9`）。本任务合并后是否发 `v1.0.7` 由人类决定，**执行位不得打 tag**。
- 若 WP-1 的签名改动面超出预期（例如发现 `restore.ts` 还有第三个调用方），**先上报再加范围**，不得顺手扩。

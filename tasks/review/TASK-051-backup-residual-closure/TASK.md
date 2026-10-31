# TASK-051 — 备份残留收口：D13-C 回写 + 目录注入 + 启动级端到端 + 保留策略失败留痕

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-051
Title: 备份残留收口：D13-C 回写 + 目录注入 + 启动级端到端 + 保留策略失败留痕
Workflow: feature
Status: REVIEW
Priority: P2
Owner: "Codex / 执行位 Implementer"
Owner Since: "2026-10-31T11:58:00+08:00"
Assigned Role: developer
Created: 2026-10-31T10:20:00+08:00
Updated: 2026-10-31T12:45:00+08:00
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

- [ ] **AC-1（WP-0）** `tasks/done/TASK-050-backup-import-and-restore/TASK.md` 的 `Merge Record` 九要素
      全部为实测值，且逐项可用命令复现：PR `25`、提交数 `16`、`merged_at 2026-10-31T01:37:54Z`、
      `merge_commit_sha 2fdd2c93bbea0ff4ec8bf3a763ede79f24e9d30a`、合并后 CI run `41156271179`（success）、
      合并后 Docker run `41156271209`（success）+ tag 触发的 `41158945149`、镜像 tag 含 `v1.0.6`/`latest`/`sha-2fdd2c9`、
      审查记录三份文件路径。**执行位须自行 `gh api` 复核后填写，不得抄本清单。**
- [ ] **AC-2（WP-0）** `Status: DONE`，目录已在 `tasks/done/`；`tasks/review/` 下不再有 TASK-050。
- [ ] **AC-3（WP-0）** `Next Action` 为终态文案且**不含**写死的 head/提交数（可见文本里无 `4d936e1`/`8ef856e`/`2fdd2c9` 之外的「当前 N 提交」表述）。
- [ ] **AC-4（WP-1）** `grep -n "process.env.BACKUP_DIR" server/src/db/restore.ts` **零命中**；
      `grep -n "config.backupDir" server/src/db/index.ts` 命中。
- [ ] **AC-5（WP-1）** 全量调用点核对留证：`grep -rn "applyPendingRestore\|resolveBackupFile" server/src server/scripts`
      逐条列出行号与传入的**参数名**（不是「看起来对」）。
- [ ] **AC-6（WP-1）** `pnpm --filter server restore-check` 仍 **24 通过 / 0 失败**、退出码 0。
- [ ] **AC-7（WP-2）** `pnpm --filter server restore-e2e` 退出码 0；输出含**两次启动**的日志片段、
      恢复后 `customers` 行数等于备份内取值、`GET /api/logs?module=restore` 命中 `applied` 记录。
- [ ] **AC-8（WP-2）** 连续跑两次 e2e 均成功（证明端口动态、临时目录不冲突、进程被回收）；
      运行后 `netstat`/`lsof` 无遗留监听，`tasklist`/`ps` 无遗留 `tsx` 子进程。
- [ ] **AC-9（WP-3）** `pnpm --filter server retention-check` 退出码 0；输出含
      「注入失败文件名」「removed 列表」「logs 中新出现的 error 行原文」三项证据。
- [ ] **AC-10（门禁）** eslint / prettier / `tsc -b` / `pnpm --filter server typecheck` / `pnpm knip` /
      `python scripts/audit-repo.py`（`PASS=9 FAIL=0`）全绿；`git status --short` 仅 File Scope 内文件。
- [ ] **AC-11（文档）** `docs/operations/backup-restore.md` 有「备份目录由调用方注入」的说明，
      并给出 `restore-e2e` / `retention-check` 两条命令与各自的判据；无失效的否定性断言残留。
- [ ] **AC-12（WP-0 边界）** 未改动 047/048/049 的既有回写；未改 `.github/workflows/**`；
      `git diff --stat main...HEAD` 无 `docker-compose.yml` / `schema.ts` / 迁移文件。

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
3. **本沙箱内 `pnpm` 的 deps-status 检查会中止**：workspace 级命令需加
   `--config.verify-deps-before-run=false`；子进程里无法稳定传该参数，故 WP-2 用
   `node --import tsx src/index.ts` 直接起服务（同一解释器、同一份源码）。
   交接与验证记录中的 pnpm 命令均已带该参数。
4. **`E:/AiData` 在本沙箱不可写**：三个脚本默认目录为 `AI_DATA_DIR ?? E:/AiData`
   （与 `restore-apply-check.ts` 一致，Task Rules 要求）。本机验证统一以
   `AI_DATA_DIR=E:/NDLDSN-WORKSPACE/.i2-review-tmp/task051` 运行；
   在 `E:/AiData` 可写的机器上无需设该变量。
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

**最新 Handoff：** `handoffs/HANDOFF-002-implementer-to-coordinator.md`
**Next Action：** 主控位对本 PR 做第一轮审查（读实际差异，不读描述）；如需整改，执行位按
`HANDOFF-003` 闭环后复审；再转 I2 独立审查；**合并需人类显式授权**，执行位未合并、未打 tag、
未自行判定 PASS。

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

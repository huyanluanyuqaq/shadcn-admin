# HANDOFF-001 — 主控位 Coordinator → 执行位 Implementer（派单）

---

## Meta

```yaml
From: 主控位 Coordinator
To: 执行位 Implementer
Task: TASK-051 — 备份残留收口
Date: 2026-10-31
Current State: READY
Previous Handoff: 无（本任务首单）
基线: main 2fdd2c9（TASK-050 已合并，已发 v1.0.6）
```

---

## 一句话目标

把 TASK-050 `Known Issues` 第 **7 / 12 / 13** 条收口到**可一条命令验证**的状态，
并按 D13-C 回填 TASK-050 的 Merge Record（**第十二实例**）。**不含任何新功能。**

---

## 基线复核（Phase 0，必须先做）

```text
git rev-parse --short main          # 期望 2fdd2c9
git status --short                  # 期望为空
pnpm --filter server restore-check  # 期望 24 通过 / 0 失败
```

不满足任一项 → **停下上报**，不要自行 rebase/清理。

---

## 实施顺序（不允许调换前两步）

### Phase 1 — WP-0：D13-C 回写（独立提交，先做）

回填 `tasks/review/TASK-050-backup-import-and-restore/TASK.md` 的 `Merge Record` 九要素。
**每一项都用命令实测，不要抄本单或 TASK.md 里的数字**：

```text
gh api repos/huyanluanyuqaq/shadcn-admin/pulls/25 \
  --jq '{merged:.merged, merged_at:.merged_at, sha:.merge_commit_sha, commits:.commits}'
gh api repos/huyanluanyuqaq/shadcn-admin/pulls/25/commits --jq 'length'
gh api "repos/huyanluanyuqaq/shadcn-admin/actions/runs?head_sha=2fdd2c93bbea0ff4ec8bf3a763ede79f24e9d30a" \
  --jq '.workflow_runs[] | "\(.id)\t\(.name)\t\(.event)\t\(.conclusion)"'
```

- 「镜像 tag」行必须能区分**合并**（`sha-*`）与**打 tag**（`v1.0.6` + `latest` + `sha-*`）两次构建；
  tag 触发的 run 请自行按 `head_branch=v1.0.6` 或 `event=push` + `tags` 实测。
- 「审查记录」行指向三份：`handoffs/2026-10-31-coordinator-review.md`、
  `2026-10-31-coordinator-review-round2.md`、`2026-10-31-review.md`（I2）。
- 填完后：`Status: DONE`；`git mv tasks/review/TASK-050-backup-import-and-restore tasks/done/`；
  `Current State` 追加终态一行；`Next Action` 改为终态且**不得写死 head/提交数**（KI-11）。
- 单独提交：`docs(TASK-050): 按 D13-C 回填 Merge Record 并归档至 done/`
- 提交后立刻 `python scripts/audit-repo.py`（F8/F9 会检查迁移后的位置与编号唯一性）。

### Phase 2 — WP-1：备份目录注入（消除双来源）

**改法**（主控位已定，不要另选方案）：

```ts
// server/src/db/restore.ts —— 不再读 process.env
export function applyPendingRestore(dbPath: string, backupDir: string): RestoreOutcome | null
function resolveBackupFile(dbPath: string, filename: string, backupDir: string): string | null
```

- 删除 `resolveBackupDir()` 内的 `process.env.BACKUP_DIR` 读取；目录**只来自入参**。
- `server/src/db/index.ts`：

```ts
import { config } from '../env.js'          // 无环：env.ts 无项目内 import
import { resolve, dirname, join } from 'node:path'

const backupDir = config.backupDir
  ? resolve(config.backupDir)
  : join(dirname(dbPath), 'backups')

export const restoreOutcome: RestoreOutcome | null = applyPendingRestore(dbPath, backupDir)
```

- **仍然禁止** `db/index.ts` import `services/logger.ts`（成环禁令不变）。
- `server/scripts/restore-apply-check.ts`：显式传 `BACKUP_DIR`（脚本已定义该常量）。
- **R5 / AC-5**：改完必须

```text
grep -rn "applyPendingRestore\|resolveBackupFile" server/src server/scripts
```

逐条列出「文件:行号 → 传入的实参名」，贴进交接。两个参数同为 `string`，
**顺序写反不会报错**，运行期会把回退副本写到错误目录（TASK-046 教训）。

### Phase 3 — WP-3：保留策略失败留痕（比 WP-2 小，先做）

```ts
// services/backup.ts
export function applyRetention(
  dir: string,
  deps: { unlink?: (path: string) => void } = {}
): string[] {
  const unlink = deps.unlink ?? unlinkSync   // 生产行为零变化
  ...
}
```

新增 `server/scripts/retention-log-check.ts`：

1. 临时目录 + `DATABASE_URL=<临时库> pnpm --filter server db:migrate`（**必须**，否则 `logs` 表不存在，
   `writeLog` 会失败并掩盖断言）；
2. 造 9 个白名单文件名（`app-20261031-12000{i}-000.db` 之类，必须匹配 `BACKUP_FILENAME_RE`），
   确保 `applyRetention` 会判定超出 `backupKeep()`（默认 7）；
3. 注入 `unlink`：对**第 1 个**被删文件抛 `Error('EACCES: injected')`，其余透传真实 `unlinkSync`；
4. 断言：① 返回 `removed` 不含该文件名；② 该文件仍存在；③ 其余 1 个超额文件已被删；
   ④ 临时库 `logs` 中新增一行 `level='error'` + `module='backup'` + `message` 含该文件名（打印原文）。

> 注意：`services/backup.ts` import `db/index.js`，脚本 import 它就会建立连接。
> 请把 `DATABASE_URL` 在**脚本进程内**先设好（`process.env.DATABASE_URL = ...` 置于 import 之前，
> 或用顶层 `await import()`），否则会连到默认 `server/data/app.db`。

### Phase 4 — WP-2：启动级端到端

新增 `server/scripts/restore-e2e-check.ts`，要求：

- **动态端口**：`net.createServer().listen(0)` 取空闲端口后 close，再传给子进程；
- **两次真实启动**：`spawn('pnpm', ['--filter','server','exec','tsx','src/index.ts'], { env })`
  （Windows 上 `pnpm` 需 `shell: true` 或走 `pnpm.cmd`；自行选能做到的方案并记录）；
  子进程 env 至少含：`DATABASE_URL=<临时库>`、`BACKUP_DIR=<临时备份目录>`、
  `PORT=<动态>`、`JWT_SECRET=<32 位随机>`、`ADMIN_PASSWORD=<测试口令>`、
  `RESTORE_AUTO_EXIT=false`、`TZ=Asia/Shanghai`；
- 流程：等 `/api/health` 就绪 → `POST /api/auth/login` 取 token → `POST /api/backups` 建一份备份 →
  记下 `customers` 行数 → 新建一行客户（载荷按 `customerCreateSchema` 必填，含 `expireAt`，
  自行读 schema 取最小合法集）→ `POST /api/backups/<imp 或 app 文件名>/restore`（期望 202）→
  **kill 子进程** → 用同一 env 二次启动 → 等健康 → `GET /api/customers` 断言行数回到备份时的值 →
  `GET /api/logs?module=restore` 断言出现 `applied` 记录（打印原文）；
- 清理：`taskkill /T /F`（Windows）或 `SIGTERM` + 超时 `SIGKILL`（POSIX）；脚本末尾打印临时目录；
- **连续跑两次都必须成功**（AC-8），并在交接里贴两次的退出码。

### Phase 5 — 收尾

- `server/package.json` 加 `"restore-e2e": "tsx scripts/restore-e2e-check.ts"`、
  `"retention-check": "tsx scripts/retention-log-check.ts"`；
- `knip.config.ts`：若不登记，knip 会把新脚本判为未使用文件（TASK-050 踩过）；
- `docs/operations/backup-restore.md` 补：目录注入口径、两条新命令与判据；
- 回填 `Changed Files` / `Known Issues`；写 `HANDOFF-002-implementer-to-coordinator.md`；
- 推送分支、开 PR、**停下**。

---

## 不要做的事

- 不改导入/恢复的 HTTP 契约、状态码、标记文件格式、`pre-restore-*` 白名单策略；
- 不改 `.github/workflows/**`（HD-2：缺 `workflow` scope，推送被拒须停工上报，禁网页绕过）；
- 不改 `docker-compose.yml` / `Dockerfile` / `schema.ts` / 迁移；
- 不重跑 047/048/049 的回写（已于 PR #25 清偿）；
- 不合并、不打 tag、不自我判定 PASS；
- 发现 WP-1 调用点超出 `restore.ts` + `db/index.ts` + `restore-apply-check.ts` 三处 →
  **先上报再扩范围**，不得顺手改。

---

## 交付时必须提供的证据

| 项 | 证据形态 |
|----|---------|
| WP-0 九要素 | 每条命令 + 输出片段（不是「已核对」） |
| WP-1 调用点 | `grep -rn` 输出 + 逐行「参数名 → 值来源」表 |
| WP-1 无回归 | `restore-check` 24/0 的完整尾部输出 |
| WP-2 e2e | 两次运行的退出码 + 健康/恢复/日志三类关键输出 + 进程与端口清理证明 |
| WP-3 留痕 | 注入失败文件名 + removed 列表 + `logs` error 行原文 |
| 门禁 | eslint / prettier / `tsc -b` / server typecheck / knip / `audit-repo.py` 的退出码 |

---

## Next Action

1. 按 Phase 0 → 5 实施（WP-0 独立提交且最先做）；
2. 交付 `HANDOFF-002-implementer-to-coordinator.md`；
3. 推送后停下，等主控位审查（必要时整改）与 I2 独立审查；合并需**人类显式授权**。

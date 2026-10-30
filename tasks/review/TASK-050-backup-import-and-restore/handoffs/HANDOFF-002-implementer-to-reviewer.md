# HANDOFF-002 — 执行位 Implementer → 审查位 Reviewer

---

## Meta

```yaml
From: 执行位 Implementer（Claude Code / Opus 5）
To: 审查位 Reviewer（须为不携带实现上下文的独立实例，见 .agents/protocols/dual-agent-model.md §5 I2）
Task: TASK-050 — 备份导入与备份恢复（补齐导出之外的两项能力）
Date: 2026-10-31
Current State: REVIEW
Previous Handoff: HANDOFF-001-coordinator-to-implementer.md（派单）
```

**本交接的意义**：把 TASK-050 的全部交付物交给**独立审查位**。
执行位**未合并、未打 tag、未自行判定 PASS、未代写审查结论**。

---

## Completed Work

按 `TASK.md` Implementation Plan 的 Phase 0 → 6 全部完成。

### Phase 0 — 基线复核与领取

```
git fetch origin                                   # 无输出（已最新）
git rev-parse main origin/main
dbb36980f60f2c047f805cfb590800df0e893344
dbb36980f60f2c047f805cfb590800df0e893344            # 与 HANDOFF-001 假设一致 ✅
git status --short
?? tasks/backlog/TASK-050-backup-import-and-restore/   # 仅未跟踪的本任务档案 ✅
```

分支 `feat/TASK-050-backup-import-and-restore`；任务目录 `backlog/ → active/`；
`Status: READY → ACTIVE`，Meta 补 `Owner` / `Owner Since`。

### Phase 1 — 文件名规则抽离

新增 `server/src/services/backup-naming.ts`（**零 import**，只放纯函数与常量）：
`BACKUP_FILENAME_RE`（`^(app|imp)-…`）、`PRE_RESTORE_PREFIX`、
`buildBackupFilename` / `buildPreRestoreFilename` / `isBackupFilename`。
`services/backup.ts` 删除本地 `FILENAME_RE` 与 `timestampFilename`，改引该模块。
`pnpm --filter server typecheck` 通过后才进入 Phase 2。

### Phase 2 — 导入

- `POST /api/backups/import`：`application/octet-stream` 原始字节流（**不走 multipart**），
  可选 `X-Backup-Filename` 仅入审计。201 → `{ item, origin, sha256 }`。
- 四层校验链（`assertImportableBackup` + 端点内的长度/魔数检查），任一失败 400/413；
  先写 `<name>.part`，全部通过才原子 `rename`；失败路径 `unlink` 临时文件。
- `shared/src/schema/entities.ts`：`backupPolicySchema` 补 `restoreAutoExit`，
  新增 `backupImportResultSchema` / `backupRestorePlanSchema`。
  **先 `pnpm build:shared` 再改后端/前端**（顺序遵守计划）。

### Phase 3 — 恢复（核心）

- `server/src/db/restore.ts`：标记读写 + `applyPendingRestore(dbPath)`。
  **先做全部前置校验**（白名单 + 存在 + `integrity_check` + 五表）再动文件；
  ① checkpoint → ② rename 现库为 `pre-restore-*` → ③ copy 备份 → ④ 删 `-wal`/`-shm`
  → ⑤ 删标记；失败分支回滚 rename、**保留标记**、返回 failed。
  ③④ 紧邻并有显式注释（Notes 末条指出的最易错点）。
- `server/src/db/index.ts`：`new Database` **之前**调用，导出 `restoreOutcome`。
- `server/src/index.ts`：启动后消费 outcome 写 `logs`（applied→`warn` / failed→`error`）。
- `server/src/env.ts`：`restoreAutoExit`（`RESTORE_AUTO_EXIT`，默认 true）。
- `POST /:filename/restore`：前置校验 → 写标记 → 审计 → 202 → 若 `restoreAutoExit`
  则 `setTimeout(() => process.exit(0), 1200)`（**先返回响应再退出**）。

### Phase 4 — 前端

`queries.ts` 增 `uploadBackup` / `useRestoreBackup` / `BACKUP_IMPORT_MAX_BYTES`；
`backups-table.tsx` 增「导入备份」（隐藏 file input + 64 MiB 前端预检）、
行内「恢复」（destructive ConfirmDialog，文案含覆盖/重启/数据丢失）、
202 后 toast + 2s/30s `/api/health` 轮询 + `window.location.reload()`、
`imp-` 文件的「导入」标识、`restoreAutoExit === true` 时的 Alert；
`backups-table.test.tsx` 新增 3 例（既有 5 例一字未改）。

### Phase 5 — D13-C 归档回写（独立提交）

TASK-047 / 048 / 049 的 `Merge Record` 九要素按 `gh api` + DockerHub Tags API **实测**回填，
`Status: REVIEW → DONE`，目录 `review/ → done/`（`git mv`）。详见下方「验证」AC-12。

### Phase 6 — 收尾

验证 → 回填档案 → 本交接 → `Status: ACTIVE → REVIEW`、目录 `active/ → review/`
→ 推送分支、开 PR → **停下**。档案与实现同批提交（KI-11）。

---

## 与设计的偏离（必须逐条过目）

| # | 偏离 | 原因 | 影响 |
|---|------|------|------|
| 1 | **新增 `server/src/services/backup-inspect.ts`**，而计划原定把 `assertImportableBackup` 放 `services/backup.ts`「供导入与恢复共用」 | 计划自身的三条要求互斥：① 校验函数放 `backup.ts` 供共用；② `db/restore.ts` **禁止** import `services/backup.ts`（成环）；③ Requirement 7 要求恢复启动期做同一套 `integrity_check` + 五表校验。只有抽到第三个零项目内依赖模块才能同时满足（不复制校验逻辑、不成环） | 多一个文件；`TASK.md` File Scope 已登记该文件与理由 |
| 2 | 冒烟新增环境变量 `SMOKE_DB_DIR`（默认 `E:/AiData`） | 恢复标记 `.restore-pending.json` 写在**数据库同目录**，第 19 段断言其存在后必须删除，否则残留会被**下一次服务启动**当成待恢复任务应用。冒烟脚本是独立进程，只能靠 env 获知服务端 DB 目录 | 冒烟多一个需传的变量；已在 `smoke.ts` 头部注释与 `backup-restore.md` 之外的文件头说明 |
| 3 | 冒烟 19.22 的 `no-store` 断言改为「现造一份备份再下载」 | 首版在 19.19 清理**之后**下载已删除的文件，拿到 404（无该响应头）。属实现顺序错误，已修 | 无（用例数不变） |
| 4 | 前端「导入」测试用 `userEvent.upload` 而非点击按钮 | 隐藏 `input[type=file]` 是 `display:none`，user-event 的指针交互会抛错 | 无；断言按 name/size 而非引用相等（`upload` 会重建 File） |
| 5 | `Hono<BackupEnv>` 类型参数 | `c.get('auth')` 在无 env 类型的 `Hono()` 下编译不过 | 无 |

**未偏离**：`docker-compose.yml` 未改；`db/schema.ts` / `migrate.ts` 未改（无 schema 变更）；
`server/data/**` 零写入；未新增任何依赖；既有四端点与 `BackupFile` 结构未变；
`app-` 前缀行为逐字节未变（已由「原版 smoke.ts 指向同服务端」交叉验证）。

---

## Changed Files

见 `TASK.md` `## Changed Files`（23 行，含新增/修改/迁移三类）。

---

## Tests

### 如何运行

```bash
# 1) shared 必须先构建（后端消费其 dist）
pnpm build:shared

# 2) AC-6 / AC-7：启动期恢复的独立验证（自建 E:/AiData 临时目录，不触碰 server/data/）
pnpm --filter server exec tsx scripts/restore-apply-check.ts

# 3) AC-8：前端浏览器单测
pnpm exec vitest run --browser.headless src/features/backups/components/backups-table.test.tsx

# 4) 全量前端单测
pnpm exec vitest run --browser.headless

# 5) 静态门禁
pnpm exec eslint <14 个改动/新增文件>
pnpm exec prettier --check <同上>
pnpm exec tsc -b
pnpm --filter server typecheck
python scripts/audit-repo.py

# 6) AC-1~AC-5 / AC-9 / AC-10：冒烟（快照库隔离）
#    6.1 快照（源 server/data/app.db，只读 VACUUM INTO）
#    6.2 起服务端（保持调度器启用；RESTORE_AUTO_EXIT=false 必须）
cd server && DATABASE_URL=E:/AiData/task050-snapshot.db PORT=3002 RESTORE_AUTO_EXIT=false \
  ENABLE_SCHEDULER=true TELEGRAM_API_BASE=http://127.0.0.1:3998 \
  FEISHU_API_BASE=http://127.0.0.1:4000 node --import tsx src/index.ts
#    6.3 跑冒烟
SMOKE_BASE_URL=http://127.0.0.1:3002 SMOKE_DB_DIR=E:/AiData pnpm --filter server smoke
```

### 结果（原始输出存档于 `E:/AiData/task050-smoke-*.log`，未入库）

| 项 | 命令 | 结果 |
|----|------|------|
| AC-6 / AC-7 | `tsx scripts/restore-apply-check.ts` | **20 通过 / 0 失败**，退出码 **0** |
| AC-8 | `vitest run … backups-table.test.tsx` | **8 passed (8)**（既有 5 + 新增 3） |
| 前端全量 | `vitest run --browser.headless` | **26 文件 / 334 用例全通过** |
| eslint | 14 个改动/新增文件 | 退出码 **0** |
| prettier | 同批文件 + 4 份文档 | **全部合规** |
| `tsc -b` | — | **0** |
| server typecheck | — | **0** |
| audit-repo.py | — | **PASS=9 FAIL=0 WARN=0** |
| AC-10 | 冒烟（快照库 + mock） | **176 通过 / 7 失败**；19.1~19.22 全绿 |
| AC-10 交叉验证 | **`main` 原版 `smoke.ts`** 指向**同一服务端** | **154 通过 / 7 失败**，7 项失败**逐字相同** |

### 「恢复成功」的数据层证据（Task Rules 第 3 条：不得仅有 202）

**证据一 —— `restore-apply-check.ts`（AC-7）**：

```
✓ C1 customers 行数等于备份内取值                 (恢复后 7 == 备份 7)
✓ C2 subscriptions 行数等于备份内取值            (恢复后 3 == 备份 3)
✓ C3 settings 键值等于备份内取值                 (RESTORED-FROM-BACKUP)
✓ C4 恢复前原库取值与备份不同                    (20 / 9 / CURRENT-BEFORE-RESTORE)
✓ C5 备份原件仍存在
✓ C6 恢复后 sha256 与备份文件一致                (逐字节相同)
```

**证据二 —— 经真实服务启动路径的端到端验证**（一次性脚本，未入库，见 Known Issues 第 10 条）：

```
准备：现库 = 快照 + 1 行哨兵客户（18 行）；备份 = 快照原件（17 行，无哨兵行）
API：  POST /api/backups/app-20261031-000000-000.db/restore  →  202 {"scheduled":true,…}
标记：  {"filename":"app-20261031-000000-000.db","requestedAt":"…","requestedBy":"admin"}
重启：  [restore] 已应用备份 app-20261031-000000-000.db，原库留作 pre-restore-20261031-005124-244.db
复核：  GET /api/customers?q=E2E-SHOULD-DISAPPEAR → total: 0（哨兵行消失）
       GET /api/customers → total: 17（回到备份取值）
       GET /api/logs?module=restore → level=warn，message「已应用备份 …，原库留作 pre-restore-…」
       标记已删除；app.db-wal / -shm 已被删除后由新进程按需重建
```

---

## Known Issues

见 `TASK.md` `## Known Issues`（第 1~5 条为派单时既有，第 6~10 条为本执行位新增）。

**审查位请特别看这三条**：

- **第 7 条**：AC-9 后半「保留策略删除失败的 `error` 日志」**未复现、无测试覆盖**。
  代码路径已写但**未实测生效**，不得据此认为它工作。
- **第 8 条**：`tasks/done/TASK-015-…/TASK.md` 的 Non-Scope 仍写「不做恢复功能」。
  作为历史记录为真故未改（改它超出 File Scope），但请确认这个处理可接受。
- **第 10 条**：「经真实服务启动路径生效」这一层**没有常驻自动化覆盖**，
  只有一次性取证。是否需要补启动级集成测试，请审查位判断。

---

## Assumptions

沿用 HANDOFF-001 的 6 条假设，逐条核对结果：

| # | 假设 | 实测 |
|---|------|------|
| 1 | `main` 仍为 `dbb3698` | ✅ 成立（`git rev-parse main origin/main` 均为 `dbb3698…`） |
| 2 | 无并行任务争用 | ✅ 成立（`backlog/` / `active/` 为空；`review/` 仅 047/048/049） |
| 3 | `RESTORE_AUTO_EXIT` 为唯一新增 env | ✅ 成立；另加**冒烟专用**的 `SMOKE_DB_DIR`（仅测试脚本读，服务端不读） |
| 4 | 单管理员 JWT 不变 | ✅ 成立；未加口令复核等更严门槛 |
| 5 | `docker-compose.yml` 不改 | ✅ 成立（零改动） |
| 6 | 前端单测可用 `getByRole` / `getByText` | ✅ 成立（新增 3 例全部用得到） |

---

## Risks

| 风险 | 现状 | 处置 |
|------|------|------|
| **恢复换文件时残留旧 `-wal`**（派单标注的「最大风险」） | 已实现且已验证：③④ 紧邻 + 失败分支清理；`restore-apply-check.ts` B4 显式断言 `-wal`/`-shm` 不存在 | 端到端验证亦确认（重启后无残留 WAL） |
| 在真实库上误跑恢复 | 未发生。全部验证只用 `E:/AiData/` 快照与临时目录；`server/data/**` 零写入（`git status` 与脚本路径可证） | Task Rules 第 1 条遵守 |
| 导入校验过松 | 四层校验 + 真 SQLite 缺表库反例（19.10） | 已覆盖 |
| 成环 | `db/restore.ts` 只 import `backup-inspect.ts` / `backup-naming.ts` / `node:*` / `better-sqlite3`，**不** import `backup.ts` 或 `logger.ts`；`db/index.ts` 不 import `logger.ts` | `tsc -b` 通过可证 |
| 冒烟漏设 `RESTORE_AUTO_EXIT=false` | 19.1 前置断言先查 `policy.restoreAutoExit === false`，不等则**明确失败并中止本段**（不静默跳过） | 已实现 |
| 上传走 `api.post` | `uploadBackup` 用原生 fetch + `application/octet-stream` | 已实现 |
| Phase 5 回填写入猜测值 | 全部字段以 `gh api` / Tags API 实测填入，命令写在单元格注释里可复现 | 已执行 |
| 文档否定性断言残留 | 四件套已改写；全仓 grep 清扫无残留；TASK-015 历史存档已显式标注 | 已处理（Known Issues 第 8 条） |
| 档案单独提交产生无谓 head | 档案与实现同批提交（KI-11） | 已遵守 |

---

## Remaining Work

**执行位侧无剩余工作。** Phase 0~6 与 AC-1~AC-13 均已完成并留证。

后续动作的所有权：

1. **独立审查位**（不携带实现上下文的新实例）按 AC-1~AC-13 复核，给出 PASS / FAIL。
2. **人类授权合并**后由主控位执行 rebase-merge。
3. 合并后 `Merge Record` 由**下一个任务**按 D13-C 选项 C 回填（本任务因此保持
   `Status = REVIEW`、留在 `tasks/review/`）。

**执行位明确未做**：`gh pr merge`、打版本 tag、自行判定 PASS、代写审查结论。

---

## Next Action

**审查位（接收方）的第一个具体动作**：

1. 读 `tasks/review/TASK-050-backup-import-and-restore/TASK.md`，重点是
   Background 的架构阻塞点、Requirements 2/6/7/8、以及 AC-6 / AC-7 的「数据层证据」判据。
2. **独立复跑**（不要采信本交接的自述）：
   ```bash
   pnpm --filter server exec tsx scripts/restore-apply-check.ts      # 期望 20/0，退出码 0
   pnpm exec vitest run --browser.headless                          # 期望 26 文件 / 334 用例
   pnpm exec tsc -b && pnpm --filter server typecheck               # 期望 0
   python scripts/audit-repo.py                                     # 期望 PASS=9 FAIL=0
   ```
3. 冒烟需自建快照库（**不要**用 `server/data/app.db`）：
   ```bash
   cd server && DATABASE_URL=E:/AiData/<审查位自己的快照>.db PORT=3002 RESTORE_AUTO_EXIT=false \
     node --import tsx src/index.ts
   SMOKE_BASE_URL=http://127.0.0.1:3002 SMOKE_DB_DIR=E:/AiData pnpm --filter server smoke
   ```
   判据是**失败集与基线逐字相同**（7 项，全在流量阈值段），**不是全绿**。
4. 逐条核对四份文档与实现，**特别是** `overview.md` §12.8 与 `backup-restore.md` §3
   原「不做应用内一键恢复」两处是否已改写、且保留了「为何改为重启式」的理由。
5. 复核本交接「与设计的偏离」5 条是否可接受，尤其第 1 条（新增 `backup-inspect.ts`）。

---

## References

- 任务档案：`tasks/review/TASK-050-backup-import-and-restore/TASK.md`（唯一事实来源）
- 派单：`handoffs/HANDOFF-001-coordinator-to-implementer.md`
- 新增模块：`server/src/services/backup-naming.ts`、`server/src/services/backup-inspect.ts`、
  `server/src/db/restore.ts`、`server/scripts/restore-apply-check.ts`
- 改动模块：`server/src/db/index.ts`、`server/src/index.ts`、`server/src/env.ts`、
  `server/src/routes/backups.ts`、`server/src/services/backup.ts`、`server/scripts/smoke.ts`
- 前端：`src/features/backups/queries.ts`、`components/backups-table.tsx`、`components/backups-table.test.tsx`
- 文档：`docs/technical/api-contract.md`、`docs/architecture/overview.md` §12.8、
  `docs/operations/backup-restore.md` §1~§6、`.env.example`
- 归档回写：`tasks/done/TASK-047|048|049-*/TASK.md` 的 `## Merge Record`
- 规范：`AGENTS.md` §13（DoD，含否定性断言核对）、§14.2（rebase-merge 与 D13-C 回写）、
  `.agents/protocols/handoff.md`、`.agents/protocols/dual-agent-model.md` §5（I2 独立性）

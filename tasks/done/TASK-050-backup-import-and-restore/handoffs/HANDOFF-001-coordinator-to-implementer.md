# HANDOFF-001 — 主控位 Coordinator → 执行位 Implementer

---

## Meta

```yaml
From: 主控位 Coordinator
To: 执行位 Implementer
Task: TASK-050 — 备份导入与备份恢复（补齐导出之外的两项能力）
Date: 2026-10-30
Current State: READY
Previous Handoff: 无（首个交接）
```

---

## Completed Work

> 主控位已完成的部分（你**不需要**重做，但**需要**复核其结论）。

- [x] **三项能力逐项核查（`main dbb3698`，2026-10-30 逐文件实读）**：
      导出 = 完整（`services/backup.ts:94` / `routes/backups.ts:31,48` / `queries.ts:54` /
      冒烟 `smoke.ts:2689-2800` / 单测 5 例）；**导入 = 零实现**（全仓 `multipart`、
      `formData(`、`upload`、`importBackup` 零命中）；**恢复 = 零实现**（`TASK-015` Non-Scope
      明示 + `overview.md:604` + `backup-restore.md:42` 两处声明「不做应用内恢复」）。
- [x] **阻塞点定位（架构级）**：`db/index.ts:27` 在**模块加载期**建立单例连接，`:35` 的
      drizzle 实例与 `services/logger.ts:1` 等大量模块绑定该单例 ⇒ 运行期 close/reopen
      无法安全替换引用 ⇒ 恢复只能采用「标记 + 重启后应用」。这是本任务全部设计的支点。
- [x] **循环依赖排查（两处，均会直接编译失败）**：
      ① `db/index.ts` ↛ `services/logger.ts`（后者 `:1` 反向 import db）；
      ② `db/restore.ts` ↛ `services/backup.ts`（后者 import `db/index.ts`）。
      对策：启动期结果由 `index.ts` 消费后写日志；文件名规则抽到零依赖的
      `services/backup-naming.ts`。
- [x] **重启前提已核实**：`docker-compose.yml:39` 为 `restart: unless-stopped`，
      退出即自启；本地 `tsx watch` 不会自启（已登记 Known Issues 第 2 条）。
- [x] **上传通道约束已核实**：`src/lib/api.ts:55` 恒设 `Content-Type: application/json`，
      `api.post` 不能用于二进制上传；须仿 `downloadBackup`（`queries.ts:54`）用原生 fetch。
- [x] **日志与审计可行性已核实**：`logs.module` 为自由文本（`schema.ts:211`），
      `writeLog(level, module, message, metadata?)` 同步且失败不影响主流程（`logger.ts:13`）。
- [x] **编号占用实测**：`tasks/backlog`、`tasks/active` 为空；`review/` 为 047/048/049
      （D13-C 待回填，本任务 Phase 5 一并回收）；`done/` 为 001–048。
      **TASK-050 无冲突**（`find tasks -maxdepth 2 -name "TASK-0*"` 实测）。
- [x] **D13-C 欠账核对**：PR #22 → `9429b23`（2026-10-21T10:40:27Z）、#23 → `d229ce1`
      （2026-10-23T02:05:24Z）、#24 → `dbb3698`（2026-10-27T07:09:37Z）。
      三者 `Status` 仍为 `REVIEW`、仍在 `tasks/review/`，`Merge Record` 全为占位。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/backlog/TASK-050-backup-import-and-restore/TASK.md` | 新增 | 任务档案（唯一事实来源） |
| `tasks/backlog/TASK-050-backup-import-and-restore/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 本文件（指派命令） |

> 主控位**未改动任何被本任务管辖的文件**（`server/**`、`src/**`、`shared/**`、`docs/**` 零变更）。
> 以上两个文件**不入库单独提交**——按 KI-11 随你的实现同批提交（见 Task Rules 第 4 条）。

---

## Tests

```yaml
命令: 未运行（设计阶段产物，零代码变更）
结果: 不适用
覆盖: 不适用
未覆盖: 全部验证留待你按 AC-1 ~ AC-13 实施
```

---

## Known Issues

- **恢复的原子性窗口**（本任务最大风险，见 `TASK.md` Notes 末条）：`rename` 与 `copy`
  之间崩溃会留下「新 `app.db` + 旧 `-wal`」，下次启动因 WAL 不匹配损坏。必须
  ③ `copy` 与 ④ 删 `-wal`/`-shm` 紧邻，且失败分支要把已复制的 `app.db` 清掉、
  把 `rename` 掉的原库移回。
- **冒烟会杀掉自己**：若启动冒烟服务端时漏设 `RESTORE_AUTO_EXIT=false`，第 19 段的
  合法恢复会触发 `process.exit(0)`，后续检查全部 ECONNREFUSED，症状像「路由全挂」。
  冒烟必须先断言 `GET /api/backups` 的 `policy.restoreAutoExit === false` 再调恢复；
  **该断言失败要报明确诊断，不得静默跳过**。
- **`overview.md:604` / `backup-restore.md:42` 是失效否定性断言的高危点**：一旦导入与恢复
  落地，这两处「不做应用内一键恢复」立即变成假话，而它们对关键词检索与变更范围检查
  **全部隐形**（`AGENTS.md` §13 明令收尾逐条复核）。AC-11 已单列为判据。
- **`pre-restore-*` 免于保留策略是有意设计**，副作用是需人工清理（Known Issues 第 4 条）。
  若审查要求「自动清理」，须先解决「回退副本与旧备份难以区分」的问题，不要图快改正则。
- **冒烟存量失败 7 项**（TASK-046 语义变更遗留）与本任务无关；判据是失败集与基线
  **逐字相同**（基线 152 通过 / 7 失败），不是全绿。

---

## Remaining Work

按 `TASK.md` Implementation Plan 执行，全部 AC 均未开始：

- **Phase 0**：基线复核 → 领取（建分支 + 移入 `active/` + Meta 补 Owner/Branch）。
- **Phase 1**：`backup-naming.ts` 抽离（先做，两侧共用）。
- **Phase 2**：导入端点 + 校验链 + shared 类型 + 前端上传。
- **Phase 3**：恢复（`db/restore.ts` + `db/index.ts` 启动钩子 + 端点 + env）。
- **Phase 4**：前端恢复按钮 / ConfirmDialog / `imp-` 标识 / 环境提示 + 三例单测。
- **Phase 5**：D13-C 归档回写（047/048/049，独立提交）。
- **Phase 6**：验证 + 回填档案 + 交付 Handoff + 推送 + 开 PR，**停下**。

---

## Assumptions

> 以下是主控位做出的假设。**若某条不成立，立即停下上报，不要自行调整范围。**

1. **`main` 仍为 `dbb3698`**（2026-10-30 实测）。开工先 `git fetch` 复核；若已推进，
   以新 head 为基线，行号可能漂移，须以当次 `git show` 复核，**不得**因此改变验证方法。
2. **无并行任务争用**（`backlog/` / `active/` 为空）。若领取时发现他人占用
   `services/backup.ts` / `routes/backups.ts` / `db/index.ts` / `smoke.ts`，**停下上报**。
3. **`RESTORE_AUTO_EXIT` 为本任务新增的唯一 env 变量**，默认 `true`；不新增其他 env。
4. **单管理员 JWT 模型不变**（ADR-002）——恢复不做权限分级，任何持有效 token 的管理员都可执行。
   若你认为需要更严格门槛（如要求重新输入口令），**上报后再做，不要自行加**。
5. **`docker-compose.yml` 不改**：`restart: unless-stopped` 已具备；若你认为需补
   `stop_grace_period` 等，**上报**，不在本任务夹带。
6. **前端单测可用 `getByRole` / `getByText`**：本文件既有 5 例已在用（`backups-table.test.tsx:72-106`）。
   若新用例取不到元素，改用 `document.querySelector` 定位，**不得改写既有 5 例**。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 恢复换文件时残留旧 `-wal` | 启动即损坏数据库，且症状像「数据没恢复」 | `db/restore.ts` 中 ③④ 紧邻 + 失败分支清理已复制的 `app.db`；AC-6 脚本显式断言 `-wal`/`-shm` 不存在 |
| 在真实库上误跑恢复 | 生产数据被覆盖 | Task Rules 第 1 条：只允许快照库 / `E:/AiData/` 临时目录；AC-6 脚本自建独立目录 |
| 导入校验过松 | 外部垃圾/异库进入备份区并被用于恢复 | 魔数 + `integrity_check` + 五表子集三重校验（Requirement 2） |
| `db/index.ts` 引入 logger 或 backup.ts 成环 | 编译/运行期循环依赖，症状诡异 | Constraints 两条显式禁令；Phase 1 先抽 `backup-naming.ts` |
| 冒烟漏设 `RESTORE_AUTO_EXIT=false` | 服务端被杀，后续全红，误判为回归 | 冒烟前置断言 `policy.restoreAutoExit`，失败给明确诊断 |
| 上传走 `api.post` | 恒 `application/json`，二进制被破坏 | Constraints 已禁用；仿 `downloadBackup` 用原生 fetch |
| Phase 5 回填写入猜测值 | 档案失真，审查必拦 | Task Rules 第 5 条：只填实测值，不确定就留「待回填」并上报 |
| 文档否定性断言残留 | 「不做恢复」与实现矛盾，且检索不可见 | AC-11 单列；收尾逐条目视 §13 清单 |
| 任务档案单独提交产生无谓 head | 历史噪声、无限回归 | KI-11：与实现同批提交 |

---

## Next Action

**接收方（执行位）的第一个具体动作，按序执行：**

1. 读完 `tasks/backlog/TASK-050-backup-import-and-restore/TASK.md`，重点是
   Background 的架构阻塞点、Implementation Plan Phase 3 的启动期顺序、以及 AC-6 / AC-7
   的「数据层证据」判据。

2. 执行 **基线复核**，记下原始输出：

   ```bash
   cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
   git fetch origin
   git rev-parse main origin/main      # 期望 dbb3698（两处）
   git status --short                  # 期望为空
   ```

3. 若基线一致 ⇒ `git switch main && git pull --ff-only`，然后：

   ```bash
   git switch -c feat/TASK-050-backup-import-and-restore
   git mv tasks/backlog/TASK-050-backup-import-and-restore tasks/active/TASK-050-backup-import-and-restore
   ```

   `TASK.md` 的 `Status` 改 `ACTIVE`，Meta 补 `Owner` / `Owner Since`。

4. 进入 **Phase 1**（`backup-naming.ts` 抽离），跑 `pnpm --filter server typecheck` 确认
   `services/backup.ts` 改造后无回归，再动 Phase 2。

> **不得跳过第 2 步。** 全部设计结论（行号、`api.ts:55` 行为、单例连接位置、
> 循环依赖方向）均以 `dbb3698` 为实测基线；head 推进后须以当次 `git show` 复核。

---

## References

- 任务档案：`tasks/backlog/TASK-050-backup-import-and-restore/TASK.md`（唯一事实来源）
- 既有备份实现：`server/src/services/backup.ts`（`runBackup` `:94`、`FILENAME_RE` `:20`、
  `resolveBackupPath` `:127`、`applyRetention` `:75`）
- 既有备份路由：`server/src/routes/backups.ts`（GET `:23`、POST `:31`、download `:48`、DELETE `:62`）
- 连接单例：`server/src/db/index.ts:27`（`new Database`）、`:35`（drizzle 实例）
- 日志反向依赖：`server/src/services/logger.ts:1`（`import { db } from '../db/index.js'`）
- 前端客户端：`src/lib/api.ts:55`（恒 JSON 头）、`src/features/backups/queries.ts:54`（blob 下载范式）
- 前端表格：`src/features/backups/components/backups-table.tsx`（顶部按钮组 `:94-118`、
  行内操作 `:160-183`、ConfirmDialog `:197-206`）
- 单测范式：`src/features/backups/components/backups-table.test.tsx`（5 例，mock `../queries` 模块）
- 冒烟范式：`server/scripts/smoke.ts:2689-2800`（第 18 段备份）+ 文件头覆盖说明格式
- 部署前提：`docker-compose.yml:39`（`restart: unless-stopped`）
- 待改写文档：`docs/architecture/overview.md:585-605`（§12.8）、
  `docs/operations/backup-restore.md:42-72`（§3 恢复步骤）、
  `docs/technical/api-contract.md:287-299`（系统备份契约）
- 体例参考：`tasks/review/TASK-049-subscription-search-customer-name/`（最近一个
  `Requires Human Approval: true` 的完整任务，含派单 / 交付 / 审查 / 整改全序列）
- 规范：`AGENTS.md` §13（DoD，含否定性断言核对）、§14.2（rebase-merge 与 D13-C 回写）、
  `.agents/protocols/handoff.md`、`.agents/protocols/task-lifecycle.md`

---

## Task Rules（与 TASK.md 同名章节一致，此处仅摘重复项）

- 验证仅限快照库与 `E:/AiData/` 临时目录，禁止在 `server/data/app.db` 上执行导入/恢复。
- 冒烟服务端须设 `RESTORE_AUTO_EXIT=false` 且保持调度器启用。
- 「恢复成功」必须有数据层证据（AC-7），不得只看 202。
- 档案与实现同批提交（KI-11）。
- Phase 5 只填实测值，不确定的留「待回填」并上报。

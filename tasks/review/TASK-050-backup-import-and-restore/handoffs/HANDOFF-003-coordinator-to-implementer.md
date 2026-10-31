# HANDOFF-003 — 主控位 Coordinator → 执行位 Implementer（整改派单）

---

## Meta

```yaml
From: 主控位 Coordinator
To: 执行位 Implementer
Task: TASK-050 — 备份导入与备份恢复
Date: 2026-10-31
Current State: CHANGES_REQUESTED
Previous Handoff: HANDOFF-002-implementer-to-reviewer
审查记录: handoffs/2026-10-31-coordinator-review.md（2 阻断 + 1 必须修 + 3 建议 + 4 记录项）
```

---

## 整改范围（按优先级，逐条闭环）

> 只改下列各项。**不要**顺手改第 19 段编号、不要重排文档结构、不要动 `docker-compose.yml`。

### B-1（阻断）回滚分支删除现库

**文件**：`server/src/db/restore.ts`

把「`dbPath` 是否存在」作为删除判据，改为「**原库是否已被改名**」：

```ts
let liveRenamed = false
try {
  if (existsSync(dbPath)) checkpointAndClose(dbPath)
  if (existsSync(dbPath)) { renameSync(dbPath, preRestorePath); liveRenamed = true }
  copyFileSync(backupPath, dbPath)
  rmSync(walPath, { force: true })
  rmSync(shmPath, { force: true })
  rmSync(restoreMarkerPath(dbPath), { force: true })
  ...
} catch (err) {
  try {
    // 只有原库已改名时，app.db 才是本次尝试复制出来的半成品；否则它是运维唯一的现库，任何情况下都不得删除
    if (liveRenamed && existsSync(dbPath)) rmSync(dbPath, { force: true })
    if (liveRenamed && existsSync(preRestorePath)) renameSync(preRestorePath, dbPath)
  } catch (rollbackErr) { ... }
}
```

**必读理由**：`currentRenamed` 在 ① `checkpointAndClose` 抛错（现库损坏 / 被占用）时仍为 `false`，
此时 `dbPath` 就是原始现库，无条件 `rmSync` 会把它删掉且不回滚 ⇒ 下次启动建空库、全量数据丢失。
主控位已用探针实测到「回滚分支对现库发起删除」（证据见审查记录 §二 B-1；探针留存
`E:/AiData/t050-probe-rollback.ts`，本机被 safe-delete 护栏拦下，Linux/容器上会真的删掉）。

**同时补回归用例**（`server/scripts/restore-apply-check.ts` 新增 E 段）：

- 场景：把现库写成**非 SQLite 内容**（`new Database` 必抛），写标记指向一份合法备份；
- 断言：`status === 'failed'`；`existsSync(DB_PATH)` **为 true**；且**字节内容逐字未变**
  （与写入前的 `sha256` 比对）；
- 该用例在 Windows 与 Linux 上均确定成立，可直接作回归护栏。

### B-2（阻断）回退副本落盘位置与文档不一致

**现状**：代码放 `<db 目录>/pre-restore-*.db`；三处文档写 `backups/pre-restore-*.db`
（`overview.md` §12.8、`backup-restore.md` §3.1/§3.4、TASK-050 Known Issues 第 4 条）。
后果：§3.4 的 `rm -f data/backups/pre-restore-*.db` 删不到文件；§5 的 rsync 不会把回退副本送异地。

**处置（已定，选改代码而非改文档）**：在 `db/restore.ts` 内抽 `resolveBackupDir(dbPath)`
（口径 = `process.env.BACKUP_DIR?.trim() || join(dirname(dbPath), 'backups')`，与现有
`resolveBackupFile` 的推导合并复用；`mkdirSync(dir, { recursive: true })` 幂等），
`preRestorePath` 改落该目录。同步把 `restore-apply-check.ts` B5 的断言路径从 `DB_DIR`
改为备份目录，并在断言名里写明目录口径。

> 若你认为必须反向（改文档）——**先在 PR 评论里说明理由并等主控位答复**，不要自行二选一。
> 改文档路线需要同时改 4 处（含 Known Issues 第 4 条）并解释 §5 rsync 覆盖缺口如何弥补。

### M-1（必须修）前端环境提示条件反转

**文件**：`src/features/backups/components/backups-table.tsx`

`restoreAutoExit === true` → 改为 `restoreAutoExit === false`；文案保持（`RESTORE_AUTO_EXIT=false`
与该分支此时才自洽）。并新增 1 例单测锁死该条件：`policy.restoreAutoExit = true` 时
**不**出现「不会自动重启」提示，`= false` 时出现。

> 规格致误说明（主控位自我披露 R-1）：`TASK.md` Requirement 10 原文写的是 `=== true`，是矛盾的措辞，
> 属派单缺陷。Requirement 10 已更正为 `=== false`。你的实现按字面执行，判为规格问题而非你的缺陷，
> 但**代码必须按更正后的语义**落地。三处文档（`api-contract` / `.env.example` / runbook §2）
> 已是正确语义，无需改动。

### M-2（建议，允许以文档一行闭环）

`docs/operations/backup-restore.md` §3.1 增一行：**取消待恢复任务** —— 删除
`<数据库所在目录>/.restore-pending.json` 即可，无需重启。理由：排程后无任何 API/UI 可撤销。

### M-3（建议）损坏标记静默忽略

`restore.ts` `readRestoreMarker` 的 catch 分支改为至少 `console.error('[restore] 恢复标记无法解析，已忽略：...')`，
并在注释里说明「文件保留，供人工检查」。若你判断该分支应让启动明确失败，**先上报**，不要自行改语义。

### L-1（建议）导入同名覆盖

`routes/backups.ts` 导入路径补 `if (existsSync(finalPath)) return 409/500 …`，与 `runBackup()`
的 `existsSync` 保护对齐。

### L-2（建议）目录约束加分隔符

`restore.ts` `resolveBackupFile` 的 `full.startsWith(dir)` → `full.startsWith(dir + sep)`（对齐 `backup.ts:129`）。

---

## 不需要做的事

- 不要改 `tasks/done/TASK-015-system-backup/TASK.md`（历史档案，已在 Known Issues 第 8 条说明）。
- 不要把 `server/scripts/**` 纳入 `tsconfig` include（属跨任务基础设施改动）。
- 不要为「取消恢复端点」新增 API（M-2 只做文档）。
- 不要重跑 D13-C 回写（047/048/049 已核验正确）。
- 不要合并、不要打 tag、不要自我判定 PASS。

---

## 验收（整改后必须全部留原始输出）

| 项 | 命令 | 期望 |
|----|------|------|
| 回滚护栏 | `pnpm --filter server restore-check` | 退出码 0，**含新增 E 段**（E1~E3），且 B5 指向备份目录 |
| 导入/恢复端到端 | 冒烟第 19 段（`RESTORE_AUTO_EXIT=false` + `SMOKE_DB_DIR=<库目录>`） | 19.x 全绿；总计数与失败集同前（176/7 或按新增项递增，7 项基线失败逐字相同） |
| 前端 | `pnpm exec vitest run --browser.headless src/features/backups/components/backups-table.test.tsx` | 9 例通过（8 + 新增提示条件 1 例） |
| 静态门禁 | eslint / prettier / `tsc -b` / `--filter server typecheck` / `audit-repo.py` | 全绿（`audit` 期望 PASS=9） |
| 工作区 | `git status --short` | 仅 File Scope 内文件 |

回填 `TASK.md` 的 `Changed Files` / `Known Issues`；写 `HANDOFF-004-implementer-to-coordinator.md`
（逐条对应 B-1/B-2/M-1/M-2/M-3/L-1/L-2 的闭环证据）；推送后**停下**。

---

## Next Action

1. `git rev-parse HEAD` 复核当前 head（应为 `ba8537e`），`git status --short` 应为空。
2. **先做 B-1**（含 E 段用例），单跑 `pnpm --filter server restore-check` 确认 E 段在**未修**时红、
   **修后**绿 —— 这一步是证明缺陷真实存在的唯一硬证据，不得跳过。
3. 再做 B-2 → M-1 → 其余。
4. 全量验收 → 回填档案 → 交付交接 → 推送 → 停下。

> 若 E 段在 `restore-check` 里因为「现库损坏时 `checkpointAndClose` 没抛错」而无法触发失败，
> 说明脚本构造不到位（例如把损坏内容写成了仍可打开的文件），**修脚本**直到能稳定复现，
> 不要因此降低断言强度。
>
> **实测口径**（主控位已验证）：把现库写成 4096 字节 `0x5A` 后，`new Database` **能正常打开**，
> `handle.pragma('wal_checkpoint(TRUNCATE)')` 抛 `SQLITE_NOTADB` —— 即失败点确在 ①，路径成立。
>
> **本机护栏警告**：本机存在 `safe-delete` 的 fs 拦截（`rmSync` 会被改写为 trash 操作），
> 它可能让 E 段在**未修**的代码上「侥幸通过」（文件没被删掉）。因此 E 段的红/绿证明必须在
> **未修的代码上先跑一次拿到红**（可 `git stash` 只回退 `restore.ts`），再在修后跑绿；
> 若本机两次都是绿，说明被护栏掩盖，须以 CI（Linux）结果为准并在交接里写明这一点。
